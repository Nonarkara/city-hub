/**
 * CityChat — a small, local chatbot for casual questions about the cities.
 *
 * Powered by Ollama running on the user's own machine (qwen2.5-coder:1.5b by
 * default). The system prompt is seeded with the hub's city facts + SLIC
 * scores so answers stay grounded. Streaming, basic, friendly — not a deep
 * research agent. Nothing leaves the machine.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { CITIES, type CityConfig } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { useUIStore } from '../store/uiStore'
import { getCityScore } from '../lib/slic'
import { streamCityChat, OLLAMA_INFO, type ChatMessage } from '../lib/ollama'
import { streamGeminiChat, GEMINI_INFO } from '../lib/gemini'

type Backend = 'cloud' | 'local'

function buildSystemPrompt(cities: CityConfig[], active: CityConfig): string {
  const lines = cities.map((c) => {
    const s = getCityScore(c.id)
    const slic = s ? ` SLIC livability ${Math.round(s.slicScore)}/100.` : ''
    return `- ${c.name} (${c.countryName}): ${c.climate}. ${c.distinctiveness}${slic}`
  }).join('\n')

  return [
    "You are City Hub's assistant — a warm, concise guide to world cities.",
    'Reply in 2-4 short sentences, plain conversational language, never code.',
    `The user is currently looking at ${active.name}, ${active.countryName}.`,
    '',
    'Cities in the dashboard:',
    lines,
    '',
    "If a question isn't about cities, gently steer back. If you don't know a",
    "fact, say so briefly rather than inventing one.",
  ].join('\n')
}

export function CityChat({ activeCity }: { activeCity: CityConfig }) {
  const customCities = useCityStore((s) => s.customCities)
  const setChatOpen  = useUIStore((s) => s.setChatOpen)

  const cities = useMemo(() => [...CITIES, ...customCities], [customCities])
  const systemPrompt = useMemo(() => buildSystemPrompt(cities, activeCity), [cities, activeCity])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  // Cloud (Gemini) is the default — it works on the deployed site for anyone.
  // Local (Ollama) is the private, offline option for when you're on your machine.
  const [backend, setBackend]   = useState<Backend>('cloud')

  const threadRef = useRef<HTMLDivElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // Auto-scroll to newest
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages])

  // Abort any in-flight stream on unmount
  useEffect(() => () => abortRef.current?.abort(), [])

  const starters = useMemo(() => [
    `What's special about ${activeCity.name}?`,
    'Compare Bangkok and Singapore',
    'Which city has the cleanest air?',
  ], [activeCity.name])

  const send = async (raw: string) => {
    const q = raw.trim()
    if (!q || busy) return
    setInput('')

    const history: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const tryStream = async (b: Backend) => {
      const stream = b === 'cloud' ? streamGeminiChat : streamCityChat
      await stream(
        [{ role: 'system', content: systemPrompt }, ...history],
        (delta) => setMessages((m) => {
          const copy = [...m]
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { role: 'assistant', content: last.content + delta }
          return copy
        }),
        ctrl.signal,
      )
    }

    try {
      await tryStream(backend)
    } catch (cloudErr) {
      // Cloud failed — auto-fallback to local (Ollama) silently
      if (backend === 'cloud' && !ctrl.signal.aborted) {
        setBackend('local')
        // Reset the assistant placeholder before retrying
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: '' }
          return copy
        })
        try {
          await tryStream('local')
        } catch {
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = { role: 'assistant', content: `⚠ Can't reach Ollama at ${OLLAMA_INFO.url}. Start it with \`ollama serve\` and make sure \`${OLLAMA_INFO.model}\` is pulled.` }
            return copy
          })
        }
      } else {
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: `⚠ Can't reach Ollama at ${OLLAMA_INFO.url}. Start it with \`ollama serve\` and make sure \`${OLLAMA_INFO.model}\` is pulled.` }
          return copy
        })
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <div className="citychat" role="dialog" aria-label="City chatbot">
      <div className="citychat-header">
        <span className="citychat-title">ASK · CITIES</span>
        <div className="citychat-backend" role="group" aria-label="Chat backend">
          <button
            className={`citychat-backend-btn ${backend === 'cloud' ? 'citychat-backend-btn--on' : ''}`}
            onClick={() => setBackend('cloud')}
            disabled={busy}
            title={`Gemini (${GEMINI_INFO.model}) — works anywhere, via Firebase`}
          >CLOUD</button>
          <button
            className={`citychat-backend-btn ${backend === 'local' ? 'citychat-backend-btn--on' : ''}`}
            onClick={() => setBackend('local')}
            disabled={busy}
            title={`Ollama (${OLLAMA_INFO.model}) — private, on your machine`}
          >LOCAL</button>
        </div>
        <button className="citychat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">✕</button>
      </div>

      <div className="citychat-thread" ref={threadRef}>
        {messages.length === 0 ? (
          <div className="citychat-empty">
            <p className="citychat-empty-hint">
              Ask me anything basic about {activeCity.name} or the other cities.{' '}
              {backend === 'cloud'
                ? `Powered by Gemini (${GEMINI_INFO.model}).`
                : 'Runs entirely on your machine via Ollama.'}
            </p>
            <div className="citychat-chips">
              {starters.map((s) => (
                <button key={s} className="citychat-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`citychat-msg citychat-msg--${m.role}`}>
              {m.content || (busy && i === messages.length - 1 ? <span className="citychat-cursor">▍</span> : '')}
            </div>
          ))
        )}
      </div>

      <form className="citychat-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? 'Thinking…' : 'Ask about a city…'}
          disabled={busy}
          aria-label="Message"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">↑</button>
      </form>
    </div>
  )
}
