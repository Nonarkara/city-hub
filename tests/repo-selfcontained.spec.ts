import { expect, test } from '@playwright/test'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve, dirname } from 'node:path'

/**
 * The repository must build from a fresh clone.
 *
 * Found 2026-10-17 while reviewing another agent's work. Both the JS alias and
 * a CSS @import pointed at `../_shared` — which resolves to
 * /Users/nonarkara/Projects/_shared, **outside this repo**, holding 1.9GB of
 * unrelated content (photos, a knowledge base, media). It was not in
 * .gitignore either, so nothing signalled it. `git clone && npm ci && npm run
 * build` failed before it started.
 *
 * Verified by renaming the external directory away and building: passes now.
 * These assertions keep it that way, because a build that only works on the
 * machine that wrote it is not a build.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|css|html)$/.test(entry)) out.push(full)
  }
  return out
}

test('nothing in the source tree reaches outside the repository', () => {
  const offenders: string[] = []
  for (const file of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'worker'))]) {
    const text = readFileSync(file, 'utf8')
    // Any surviving `_shared` reference must point inward, e.g. '../shared/'.
    for (const match of text.matchAll(/['"(]([^'"()]*_shared[^'"()]*)['")]/g)) {
      const ref = match[1]
      const target = resolve(dirname(file), ref)
      if (!target.startsWith(ROOT)) {
        offenders.push(`${file.replace(ROOT, '.')} → ${ref}`)
      }
    }
  }
  expect(offenders, 'references resolving outside the repo').toEqual([])
})

test('the @shared alias points inside the repository', () => {
  const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
  const alias = vite.match(/'@shared':\s*fileURLToPath\(new URL\('([^']+)'/)
  expect(alias, 'the @shared alias must be declared').toBeTruthy()
  // '../_shared' is the outside-the-repo form that broke fresh clones.
  expect(alias![1].startsWith('..')).toBe(false)
})

test('every vendored module the app imports actually exists in the repo', () => {
  expect(existsSync(join(ROOT, 'shared/lib/gistda.js'))).toBe(true)
  expect(existsSync(join(ROOT, 'shared/design-tokens/dr-non-brand.css'))).toBe(true)
})

test('the vendored copy is small enough to belong in a repository', () => {
  // The external directory was 1.9GB. If this ever grows, something unrelated
  // is being dragged in and the repo stops being cloneable.
  const bytes = walk(join(ROOT, 'shared')).reduce(
    (total, file) => total + statSync(file).size, 0,
  )
  expect(bytes).toBeLessThan(512 * 1024)
})