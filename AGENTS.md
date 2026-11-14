# AGENTS.md

LicenseHub: Next.js 16 App Router (JavaScript, no TypeScript) + Tailwind 4 / DaisyUI 5 app for issuing and verifying SaaS license keys. Product behavior and API contract: `README.md`.

## Commands

- `npm install` — Node 20+.
- `npm run dev` — http://localhost:3000
- `npm run build` / `npm start` — there is no lint, typecheck, or test script and no CI. `npm run build` is the only automated check.
- The build prints a Turbopack warning about dynamic filesystem access in `lib/db.js`. That is expected from the configurable `DB_PATH`; don't chase it.

## Architecture and boundaries

- `app/` = pages + route handlers, `components/` = client views, `lib/` = all logic. `@/*` maps to the repo root (`jsconfig.json`), e.g. `@/lib/db`.
- Server pages read the store and pass plain props to `"use client"` views; mutations go through `fetch` to `/api/*` then `router.refresh()`. Follow this pattern.
- `lib/db.js` is the only storage layer: synchronous JSON-in-text-file access to `data/db.txt` (override with `DB_PATH`), atomic tmp+rename writes, fallback to the OS temp dir when the target is read-only. Keep all storage logic there.
- Neon is linked via `neon.ts` and `.neon` (gitignored). `neon init` populated `.env.local` with `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and branch variables — never print their values. The app still uses `data/db.txt`; storage has **not** been migrated to Postgres.
- `lib/db.js` and `lib/keys.js` use `node:fs` / `node:crypto` and are server-only. Never import them from `"use client"` files.
- Every API handler needs `export const runtime = "nodejs"`. Pages that read the store need `export const dynamic = "force-dynamic"` — otherwise Next may prerender/cache against a missing data file.
- Auth: `proxy.js` redirects unauthenticated page requests to `/login` and returns `401` for admin APIs; `/api/verify` stays public. Login sessions are signed HMAC cookies (`lib/auth.js`) with credentials from `ADMIN_USER`/`ADMIN_PASSWORD`; `AUTH_SECRET` signs sessions and falls back to the password. HTTP Basic auth is still accepted for scripts. If you add another public route, update the matcher in `proxy.js`.
- Next expands `$VAR` in env files and treats `#` as a comment. Quote values containing `#` or `$`, and escape a literal `$` as `\$` in `.env.local` (the same rule applies to `DATABASE_URL` passwords).

## Domain invariants

- Key format is `<term>-XXXX-XXXX-XXXX-XXXX-XXXX`. The first character is the term code from `LICENSE_TYPES` (`M`, `3`, `Y`); the body is 20 chars from a 32-symbol alphabet that omits look-alikes. Changing `lib/keys.js` normalization/hashing or the alphabet invalidates already-issued keys, which cannot be regenerated.
- Only the SHA-256 hash and `last4` are stored. The plaintext key exists solely in the `POST /api/keys` response — never log it or persist it.
- Terms start on the first successful `POST /api/verify`, not at generation. Status is derived by `keyStatus()` (`unused`/`active`/`expired`/`revoked`), not stored; don't add a status field.
- `lib/constants.js` is the single source for SaaS products, client types, pricing models, and license terms. Validation, APIs, and UI all read it; edit it instead of hardcoding lists.
- `data/db.txt` (gitignored) holds all clients and keys. Deleting or corrupting it loses every key irrecoverably (the loader throws on corrupt JSON rather than wiping it). On serverless hosts the read-only fallback is temporary and per-instance.

## UI

- Tailwind 4 + DaisyUI 5 are configured in `app/globals.css` through `@plugin "daisyui"`; there is no `tailwind.config.js`. Use DaisyUI component classes.
- Format dates with the UTC helpers in `lib/format.js`, not `toLocaleDateString`, so server and client render identical markup. Keep key display masked via `maskedKey()`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
