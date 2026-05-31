/**
 * Local Ollama chat client — streaming.
 *
 * Talks to a locally-running Ollama server (`ollama serve`) over its REST API.
 * Default model is qwen2.5-coder:1.5b — small + fast, enough for basic city
 * Q&A. No cloud, no key, no data leaves the machine.
 *
 * Local dev (localhost) works out of the box — Ollama allows localhost origins.
 * For the DEPLOYED site, the user must allow the page origin on their own
 * machine, e.g.:  OLLAMA_ORIGINS="https://city-hub.pages.dev" ollama serve
 */
const OLLAMA_URL   = (import.meta.env.VITE_OLLAMA_URL as string | undefined)   ?? 'http://localhost:11434'
const OLLAMA_MODEL = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'qwen2.5-coder:1.5b'

export const OLLAMA_INFO = { url: OLLAMA_URL, model: OLLAMA_MODEL }

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream a chat completion. Calls `onToken` with each text delta as it arrives.
 * Throws if the server is unreachable or returns a non-OK status (caller shows
 * a friendly offline message).
 */
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

    // Ollama streams newline-delimited JSON objects.
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
        // Partial JSON across chunk boundary — re-buffer and continue.
        buffer = line + '\n' + buffer
        break
      }
    }
  }
}
