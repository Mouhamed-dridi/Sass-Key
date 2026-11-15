# AGENTS.md

LicenseHub: Next.js 16 App Router (JavaScript, no TypeScript) + Tailwind 4 / DaisyUI 5 app for issuing and verifying SaaS license keys. Product behavior and API contract: `README.md`.

## Commands

- `npm install` — Node 20+.
- `npm run dev` — http://localhost:3000
- `npm run build` / `npm start` — there is no lint, typecheck, or test script and no CI. `npm run build` is the only automated check.
- Local runs and builds that render pages need `DATABASE_URL` in `.env.local` (Neon). On Netlify it is a site environment variable. There is no file-based fallback.

## Architecture and boundaries

- `app/` = pages + route handlers, `components/` = client views, `lib/` = all logic. `@/*` maps to the repo root (`jsconfig.json`), e.g. `@/lib/db`.
- Server pages read the store and pass plain props to `"use client"` views; mutations go through `fetch` to `/api/*` then `router.refresh()`. Follow this pattern.
- `lib/db.js` is the only storage layer: PostgreSQL (Neon) through `pg`, all functions **async** (always `await` them). It creates the `users`, `clients` and `license_keys` tables on first use, under an advisory lock so parallel serverless cold starts don't race. Keep all SQL there.
- Neon is linked via `neon.ts` and `.neon` (gitignored). `.env.local` holds `DATABASE_URL` — never print or commit its value. `lib/db.js` strips `channel_binding` (node-postgres doesn't support it) and pins `sslmode=require` to `verify-full`.
- Dates reach the UI as strings: `registered_at` as `YYYY-MM-DD`, timestamps as ISO 8601 (custom `pg` type parsers in `lib/db.js`). `revoked` is a boolean.
- `lib/db.js`, `lib/keys.js`, and `lib/passwords.js` are server-only (`pg` / `node:crypto`). Never import them from `"use client"` files.
- Every API handler needs `export const runtime = "nodejs"`. Pages that read the store need `export const dynamic = "force-dynamic"` — otherwise Next may prerender them at build time.
- Auth: `proxy.js` redirects unauthenticated page requests to `/login` and returns `401` for admin APIs; `/api/verify` stays public. Login sessions are signed HMAC cookies (`lib/auth.js`) with credentials from `ADMIN_USER`/`ADMIN_PASSWORD`; `AUTH_SECRET` signs sessions and falls back to the password. HTTP Basic auth is still accepted for scripts. If you add another public route, update the matcher in `proxy.js`.
- Users added in Settings are stored in the Postgres `users` table via `listUsers`/`findUserByUsername`/`createUser`; passwords are scrypt hashes from `lib/passwords.js` (never plaintext). Session tokens carry the username in `sub`; verification accepts any non-empty signed subject. The env admin stays the built-in administrator and its username is reserved.
- Next expands `$VAR` in env files and treats `#` as a comment. Quote values containing `#` or `$`, and escape a literal `$` as `\$` in `.env.local` (the same rule applies to `DATABASE_URL` passwords).

## Domain invariants

- Key format is `<term>-XXXX-XXXX-XXXX-XXXX-XXXX`. The first character is the term code from `LICENSE_TYPES` (`M`, `3`, `Y`); the body is 20 chars from a 32-symbol alphabet that omits look-alikes. Changing `lib/keys.js` normalization/hashing or the alphabet invalidates already-issued keys, which cannot be regenerated.
- Only the SHA-256 hash and `last4` are stored. The plaintext key exists solely in the `POST /api/keys` response — never log it or persist it.
- Terms start on the first successful `POST /api/verify`, not at generation. Status is derived by `keyStatus()` (`unused`/`active`/`expired`/`revoked`), not stored; don't add a status field.
- `lib/constants.js` is the single source for SaaS products, client types, pricing models, and license terms. Validation, APIs, and UI all read it; edit it instead of hardcoding lists.
- The Postgres database holds all clients, keys, and added users. Losing it loses every key irrecoverably (only hashes are stored), so keep Neon backups/branches in mind before destructive changes. First activation in `verifyLicense` is a conditional `UPDATE ... WHERE activated_at IS NULL`; keep it atomic.

## UI

- Tailwind 4 + DaisyUI 5 are configured in `app/globals.css` through `@plugin "daisyui"`; there is no `tailwind.config.js`. Use DaisyUI component classes.
- Dark mode is a `data-theme` attribute (`light`/`dark`) persisted in `localStorage` under `licensehub-theme` (`lib/theme.js`). `app/layout.js` injects `THEME_SCRIPT` before first paint and sets `suppressHydrationWarning` on `<html>`; keep that script and the Settings toggle in sync.
- Format dates with the UTC helpers in `lib/format.js`, not `toLocaleDateString`, so server and client render identical markup. Keep key display masked via `maskedKey()`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
