/**
 * Local Ollama client — chat streaming + single-shot generation.
 *
 * Default model upgraded to phi4-mini: a 2.5 GB general-purpose reasoning
 * model far better suited for city intelligence questions than a coding model.
 * qwen2.5-coder:1.5b remains available by overriding VITE_OLLAMA_MODEL.
 *
 * For the deployed site, allow the page origin:
 *   OLLAMA_ORIGINS="https://hub.nonarkara.org,https://city-hub.pages.dev" ollama serve
 */
const OLLAMA_URL   = (import.meta.env.VITE_OLLAMA_URL   as string | undefined) ?? 'http://localhost:11434'
const OLLAMA_MODEL = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'phi4-mini'

export const OLLAMA_INFO = { url: OLLAMA_URL, model: OLLAMA_MODEL }

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

/** Stream a chat completion — calls onToken with each text delta. */
export async function streamCityChat(
  messages: ChatMessage[],
  onToken:  (delta: string) => void,
  signal?:  AbortSignal,
): Promise<void> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: OLLAMA_MODEL, messages, stream: true }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`Ollama responded ${res.status}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const json = JSON.parse(trimmed)
        if (json.message?.content) onToken(json.message.content as string)
        if (json.done) return
      } catch {
        buffer = line + '\n' + buffer
        break
      }
    }
  }
}

/**
 * Single-shot text generation — for the Situation Brief and similar non-chat
 * use-cases. Returns the full completion as a string. No streaming.
 * Uses a different (possibly larger) model when specified.
 */
export async function generateText(
  prompt: string,
  opts?: { model?: string; maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  // For the brief, prefer deepseek-r1 if available — it's better at synthesis
  const model = opts?.model ?? OLLAMA_MODEL
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model,
      prompt,
      stream:  false,
      options: { num_predict: opts?.maxTokens ?? 200 },
    }),
    signal: opts?.signal,
  })
  if (!res.ok) throw new Error(`Ollama generate ${res.status}`)
  const data = await res.json() as { response?: string }
  return data.response?.trim() ?? ''
}

/** Check if Ollama is reachable (fast probe). */
export async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
