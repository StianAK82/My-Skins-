# Verified repository baseline

Date: 2026-07-30 (UTC)
Baseline commit before this milestone: `5ddd331`
Environment: Linux workspace container, Node `v24.15.0`, pnpm `10.28.1`

This file records observed command results. “Green” is intentionally not used
for the complete milestone because Chromium download was externally blocked.

| Command | Exit | Result |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile current; warning that `canvas@3.2.2` build script is ignored |
| `pnpm typecheck` | 0 | Library build plus API, production frontend, mockup sandbox and scripts passed |
| `pnpm test:unit` | 0 | API 117/117 and frontend 46/46; zero skipped |
| `pnpm test:integration` | 0 | 22/22 Classic storage and Roblox pipeline tests; no external service calls |
| `pnpm build` | 0 | API and both web packages built |
| `pnpm exec playwright test --list` | 0 | Three smoke/workflow tests discovered |
| `pnpm exec playwright install chromium` | 1 | All Playwright CDN mirrors returned HTTP 403 |
| `pnpm test:visual` | 1 | Three tests discovered; all stopped at browser launch because the managed Chromium binary could not be downloaded |

No test used a live AI provider, Roblox API, production database, or production
object store. Database retention uses an injected deterministic repository.
Playwright workflow responses are defined only in `visual-tests/` and cannot be
enabled by production runtime configuration.

## Build sizes

- API bundle: 3.0 MB (`dist/index.mjs`), source map 6.1 MB.
- Production frontend main JS: 1,499.07 kB, 420.45 kB gzip.
- Production frontend CSS: 105.81 kB, 17.32 kB gzip.
- GLTFExporter chunk: 35.25 kB, 10.51 kB gzip.
- Mockup sandbox JS: 187.72 kB, 59.51 kB gzip.

Vite warns that the production frontend main chunk exceeds 500 kB. Bundle
optimization is not part of this stability milestone.

## Playwright portability

Playwright now uses its managed Chromium by default. An optional
`PLAYWRIGHT_CHROMIUM_PATH` override is accepted only when the referenced file
exists; an invalid explicit override fails during configuration with a clear
error. CI installs Playwright Chromium before running the same smoke tests.

## External limitation

Chromium build `1187` could not be downloaded: each attempted
`cdn.playwright.dev` / `playwright.download.prss.microsoft.com` URL returned
HTTP 403. Screenshots and browser execution are therefore not reported as
passing in this environment.
