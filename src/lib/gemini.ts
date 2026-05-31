/**
 * Gemini cloud chat — via Firebase AI Logic (the GoogleAIBackend / Gemini
 * Developer API). Reuses the Firebase `app` already initialized in firebase.ts.
 *
 * Unlike the local Ollama path, this works on the DEPLOYED site for any
 * visitor — calls are proxied through Firebase, so no Gemini key is exposed.
 *
 * One-time enable: Firebase console → Build → "AI Logic" → enable the Gemini
 * Developer API for the project. Until then, calls throw and the chat shows a
 * friendly setup hint.
 */
import { getAI, getGenerativeModel, GoogleAIBackend, type AI } from 'firebase/ai'
import { app } from './firebase'
import type { ChatMessage } from './ollama'

const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? 'gemini-2.5-flash'

export const GEMINI_INFO = { model: GEMINI_MODEL }

let _ai: AI | null = null
function ai(): AI {
  if (!_ai) _ai = getAI(app, { backend: new GoogleAIBackend() })
  return _ai
}

/**
 * Stream a Gemini chat completion. Mirrors streamCityChat's signature so the
 * chat UI can swap backends with one branch. System message becomes Gemini's
 * systemInstruction; assistant↔model role mapping handled here.
 */
export async function streamGeminiChat(
  messages: ChatMessage[],
  onToken:  (delta: string) => void,
  signal?:  AbortSignal,
): Promise<void> {
  const system = messages.find((m) => m.role === 'system')?.content
  const model = getGenerativeModel(ai(), {
    model: GEMINI_MODEL,
    ...(system ? { systemInstruction: system } : {}),
  })

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role:  (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
      parts: [{ text: m.content }],
    }))

  const result = await model.generateContentStream({ contents })
  for await (const chunk of result.stream) {
    if (signal?.aborted) return
    const text = chunk.text()
    if (text) onToken(text)
  }
}
