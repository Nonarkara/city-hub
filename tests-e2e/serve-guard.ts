/**
 * Fails the e2e run if the server answering on the test port is not this app.
 *
 * This exists because the suite was silently green-adjacent and wrong for a
 * whole session. `reuseExistingServer: true` on a shared port meant that when
 * another project's dev server was already listening there, Playwright reused
 * it — and every test ran against a transit app with a different DOM. The
 * failures looked like ordinary locator timeouts, so the diagnosis that actually
 * explained them ("you are testing someone else's product") took a screenshot to
 * find.
 *
 * A port collision is not a test failure, it is a broken harness, and it must
 * stop the run rather than turn into four confusing timeouts.
 */
export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4183'
  let html = ''
  try {
    const res = await fetch(baseURL, { headers: { Accept: 'text/html' } })
    html = await res.text()
  } catch (err) {
    throw new Error(
      `[e2e] nothing answering at ${baseURL}. Start the dev server first ` +
      `(npm run dev -- --host 127.0.0.1 --port 4183). Underlying: ${String(err)}`,
    )
  }
  if (!/City Hub/i.test(html)) {
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '(no title)'
    throw new Error(
      `[e2e] ${baseURL} is serving "${title}", not Dr Non's City Hub.\n` +
      `Another project's dev server is on that port. Use the dedicated port 4183 ` +
      `rather than a shared one, or stop the other server.`,
    )
  }
}
