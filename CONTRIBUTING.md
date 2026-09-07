# Contributing

Thanks for taking City Hub seriously enough to change it.

This is independent civic software — not a vendor platform and not an official
BMA, DEPA, or government product. Keep it that way.

## Run it first

The honest path is in the README. Short version:

```bash
git clone https://github.com/Nonarkara/city-hub.git
cd city-hub
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Mapbox is optional. Fill
only the names in `.env.example` that you actually have. Never commit
`.env.local`.

Optional CORS proxy: `cd worker && npm install && npx wrangler dev`, then set
`VITE_PROXY_URL=http://127.0.0.1:8787`. Worker secrets go through
`npx wrangler secret put` — never into git.

## What we welcome

- Bug fixes with a reproduction
- Docs that make a stranger's first run clearer
- Open-data adapters that still boot when a key is missing
- Accessibility and mobile fixes

## Please don't

- Commit secrets, tokens, service-account JSON, or `.env.local`
- Open a public issue for a security problem — see [SECURITY.md](SECURITY.md)
- Add a paid-only path without a free fallback
- Present a fork as an official Bangkok / BMA / DEPA product
- Strip the Worker CORS allowlist and republish it as an open proxy

## Pull requests

1. Branch from `main`.
2. Keep the change focused.
3. Do not paste credentials into the PR, screenshots, or logs.

Questions: [non@nonarkara.org](mailto:non@nonarkara.org)
