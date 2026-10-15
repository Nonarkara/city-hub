import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

test('comparison has a visible lazy-loading and recovery boundary', () => {
  const app = read('src/App.tsx')
  expect(app).toContain('function CompareLoading()')
  expect(app).toContain('fallback={<CompareLoading />}')
  expect(app).toContain('fallback={<CompareFailure')
  expect(app).not.toContain('splitOpen && <ErrorBoundary fallback={null}><SplitCompare')
})

test('comparison is primary and does not retain the dashboard map or pollers', () => {
  const app = read('src/App.tsx')
  const uiStore = read('src/store/uiStore.ts')
  const mapView = read('src/components/MapView.tsx')

  expect(uiStore).toMatch(/splitOpen:\s*true/)
  expect(app).toMatch(/!splitOpen\s*&&\s*\(\s*<MapView/)
  expect(app).toContain('useAnomalies(bangkokMode && !splitOpen)')
  expect(app).toContain('useCityRisk(!splitOpen)')
  expect(app).toContain('useCityStress(!splitOpen)')
  expect(mapView).toContain('onMapReady?.(null)')
})
