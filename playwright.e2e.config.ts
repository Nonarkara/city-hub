import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests-e2e',
  // Each test boots a map, waits on the Overpass proxy and drives a real
  // render. 30s was fine for two tests and became the cause of failure for the
  // rest: the city-image and city-search specs both passed in isolation in
  // 15–19s and timed out at 30s inside the full run. A timeout that fires only
  // when the suite is otherwise healthy is measuring the machine, not the code.
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4183',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // A dedicated port, and never reused. The suite used 4173 with
  // `reuseExistingServer: true`, so another project's dev server could be
  // silently substituted for this one and every test would run against the
  // wrong application. See tests-e2e/serve-guard.ts.
  globalSetup: './tests-e2e/serve-guard.ts',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4183',
    url: 'http://127.0.0.1:4183',
    // Reuse is safe *because* of the guard above. `false` means a stale dev
    // server from a killed run blocks the suite from starting at all; `true`
    // with no identity check means another project's app is silently tested.
    // The guard turns reuse into "reuse only if it is ours".
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'] },
    },
  ],
})
