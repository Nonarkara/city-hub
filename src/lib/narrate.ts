/**
 * Frontend wrapper for the Worker /narrate route — Gemini-narrated
 * explanations of any situation snapshot.
 */

const PROXY = (import.meta.env.VITE_PROXY_URL as string | undefined) ?? 'http://127.0.0.1:8787'

export type NarrateModel = 'gemini-2.5' | 'template'

export interface NarrateResult {
  narration: string
  model: NarrateModel
}

export async function narrate(
  question: string,
  context: unknown,
  opts?: { style?: 'brief' | 'paragraph' | 'mayor'; maxWords?: number },
): Promise<NarrateResult> {
  try {
    const res = await fetch(`${PROXY}/narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context,
        style: opts?.style ?? 'brief',
        maxWords: opts?.maxWords ?? 60,
      }),
    })
    if (!res.ok) throw new Error(`narrate ${res.status}`)
    return await res.json() as NarrateResult
  } catch {
    return {
      narration: 'Explanation unavailable — narrate endpoint unreachable.',
      model: 'template',
    }
  }
}
