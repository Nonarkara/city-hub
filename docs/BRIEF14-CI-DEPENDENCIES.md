# Brief 14: CI and dependency fixes

Base: `e18e1ae` on `origin-new/main`. PR only; no merge or deployment.

## Scope

- Task 1 completed: one build workflow for pull requests and main pushes, documentation exclusions, cancellation, npm cache, read-only permissions, SHA-pinned actions and a ten-minute ceiling. No browsers, schedule, deployment or manual trigger. `worker/package.json` has no test script, so no worker test step was added.
- Task 2 skipped under the brief's PR #4 exclusion. `gh pr view 4 --repo Nonarkara/city-hub --json title,state,files` confirms that the open PR owns `worker/src/index.ts`, `src/components/AlertPanel.tsx`, `src/components/LiteCityPanel.tsx`, `src/data/source-registry.ts` and `src/index.css`. The route error handling and affected dashboard surfaces need those files. Read-only checks still returned Traffy HTTP 502 and GDELT HTTP 429. This PR does not claim to fix those failures.
- Task 3 completed with a scoped override instead of an ineffective Firebase major upgrade. Vite moves from 6.4.3 to 6.4.6; re2js from 2.8.6 to 2.10.0; source-map-js from 1.2.1 to 1.2.4. Firestore resolves gRPC 1.13.6 instead of 1.9.16. Audit reports zero vulnerabilities.

## Firebase decision and limit

Firebase is used by `src/lib/firebase.ts`, `src/lib/db.ts` and `src/lib/gemini.ts`, with callers in the application, onboarding and Action Center. It is not unused. No services were enabled and no Google API, database read/write or authenticated request was made.

12.19.0 is the latest stable 12.x release checked in npm. The latest Firebase 13.4.0 also declares Firestore's gRPC dependency as `~1.9.0`; upgrading the SDK would not fix this advisory by itself and introduces AI Logic breaking changes. Keep Firebase 12.19.0 and scope the exact gRPC override to `@firebase/firestore`.

The override exceeds Firestore's declared range. Tests prove actual dependency resolution and offline document construction, not authenticated network transport or Firebase emulator compatibility. Revisit the override when upstream ships a patched dependency range. The scope avoids changing other dependency consumers.

Sources: [gRPC advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j), [Firebase release notes](https://firebase.google.com/support/release-notes/js), npm registry metadata for Firebase, Firestore and Vite.

## Local verification

The worktree contains no copied environment files. Node 22.22.2 matches CI's runtime major. Nothing in this PR was deployed or tested as a new production release.

| Command | Result |
| --- | --- |
| `npm audit --package-lock-only --json` before edits | Reproduced seven high findings; exit 1 |
| `npm view vite@6 version engines --json` | Patched 6.4.6 available |
| `npm view firebase version engines --json` | Latest 13.4.0 |
| npm registry metadata checks for stable 12.x and 6.x | Latest 12.19.0 and 6.4.6 |
| `npm view firebase@13.4.0 dependencies.@firebase/firestore dependencies.@firebase/firestore-compat --json` | Firestore 4.20.0 / compat 0.4.18 |
| `npm view @firebase/firestore@latest version dependencies.@grpc/grpc-js --json` | 4.20.0 still pins `~1.9.0` |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` | Pass |
| `npm update re2js source-map-js --package-lock-only --ignore-scripts --no-audit --no-fund` | Pass |
| `npm ci --no-fund` | Pass; 187 installed packages; zero vulnerabilities |
| `npm audit --package-lock-only --audit-level=high --json` | Pass; zero vulnerabilities at all severities |
| `npm audit --audit-level=high` | Pass; zero vulnerabilities |
| `npm test -- --workers=2` on Node 26 | 136 existing tests passed |
| `npm run build` on Node 26 | Stopped by the author during Vite transformation; replaced by the Node 22 run below; not a passing build claim |
| `env PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/bin:/bin npm run build` | Pass; 218 modules; existing large-chunk warning remains |
| `env PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/bin:/bin npm test -- --workers=2` | 138 passed, including two new dependency tests |
| `/tmp/cityhub-actionlint-brief14/actionlint .github/workflows/ci.yml` | Pass; actionlint 1.7.12 from its official release |
| `gh api repos/actions/{checkout,setup-node}/git/ref/tags/v4` (one request per action) | Resolved the action SHAs used in CI |
| `git diff --check` | Pass |
| Public proxy GETs with the production Origin header, discarding bodies | Traffy 502, GDELT 429; unresolved |

`npm test` is the repository's non-browser Playwright suite. `npm run test:e2e` was not run. No UI files changed, so before/after screenshots and visual review are not applicable. No workflows were manually dispatched or rerun; normal PR/push triggers are declared by the new workflow.

## Independent review

A separate agent reviewed the diff and reported no confirmed defects. They independently verified both pinned action refs and offline Firestore/gRPC loading, and flagged the transport-compatibility limit above. They did not submit a GitHub approval. Install, audit, Node 22 build and full test results are author-run evidence, not independently reproduced suite results.
