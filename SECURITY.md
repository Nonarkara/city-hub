# Security Policy

## Supported versions

`main`, and the live site at [city-hub.pages.dev](https://city-hub.pages.dev).

## Reporting a vulnerability

Do not open a public GitHub issue for security problems.

1. Prefer a private [GitHub Security Advisory](https://github.com/Nonarkara/city-hub/security/advisories/new).
2. Or email **[non@nonarkara.org](mailto:non@nonarkara.org)** with impact, a
   reproduction, and whether anything is already public.

We will acknowledge the report and follow up. Please give us time to patch
before disclosure.

## Secrets

This repository must not contain production secrets. Client tokens belong in
`.env.local` (gitignored). Worker secrets belong in Cloudflare
(`wrangler secret put`). [`.env.example`](.env.example) lists variable
*names* only — never paste real values into git, issues, or pull requests.
