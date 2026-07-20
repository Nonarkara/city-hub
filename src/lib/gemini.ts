/**
 * Gemini cloud chat — via Firebase AI Logic (the GoogleAIBackend / Gemini
 * Developer API). Uses the lazily-initialized Firebase app from firebase.ts,
 * so the SDK only loads when chat is actually opened.
 *
 * Unlike the local Ollama path, this works on the DEPLOYED site for any
 * visitor — calls are proxied through Firebase, so no Gemini key is exposed.
 *
 * One-time enable: Firebase console → Build → "AI Logic" → enable the Gemini
 * Developer API for the project. Until then, calls throw and the chat shows a
 * friendly setup hint.
 */
import type { AI } from 'firebase/ai'
import { getFirebaseApp } from './firebase'
import type { ChatMessage } from './ollama'

const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? 'gemini-2.5-flash'

export const GEMINI_INFO = { model: GEMINI_MODEL }

let _ai: Promise<AI> | null = null
function ai(): Promise<AI> {
  if (!_ai) {
    _ai = Promise.all([getFirebaseApp(), import('firebase/ai')])
      .then(([app, { getAI, GoogleAIBackend }]) => getAI(app, { backend: new GoogleAIBackend() }))
  }
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
  const [aiInstance, { getGenerativeModel }] = await Promise.all([ai(), import('firebase/ai')])
  const model = getGenerativeModel(aiInstance, {
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
