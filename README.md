# LicenseHub

Small admin app for generating and tracking license keys for the SaaS products you deliver to clients.
Next.js + DaisyUI, with all data (users, clients, license keys) stored in PostgreSQL (Neon).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
# production:
npm run build && npm start
```

Needs Node 20+ and a PostgreSQL connection string in `DATABASE_URL` (put it in `.env.local`; on Netlify add it under
Site configuration → Environment variables). The tables are created automatically on first use.

## What's in it

- **Dashboard**: client / key counts and recent activity.
- **Clients**: table plus an "Add client" pop-up (name, type, register date, description, pricing model, SaaS).
- **Key Generator**: choose client, SaaS and term, generate. The full key is shown once.
- **Settings**: switch between light and dark mode, and add extra admin users who can sign in.

## Key format

`<type>-XXXX-XXXX-XXXX-XXXX-XXXX`

| First character | Term     |
| --------------- | -------- |
| `M`             | 1 month  |
| `3`             | 3 months |
| `Y`             | 1 year   |

The 20 characters after the type are random (100 bits, no look-alike characters such as O/0 or I/1).
Only the SHA-256 hash of a key is stored, plus its last 4 characters so you can recognise it in the list.
If a client loses a key, revoke it and generate a new one.

## Key lifecycle

`unused` → `active` → `expired`, or `revoked` at any time.
The term starts the first time the key is verified, not when it is generated.

## Verifying keys from your SaaS apps

```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"key":"Y-XXXX-XXXX-XXXX-XXXX-XXXX","saas":"ParkingPlus"}'
```

Valid: `{ "valid": true, "saas": "...", "type": "Y", "client": "...", "activated_at": "...", "expires_at": "..." }`

Invalid: `{ "valid": false, "reason": "invalid_key" | "wrong_product" | "revoked" | "expired" }`

`saas` is optional; send it to make sure a key is only accepted by the product it was issued for.

## Protecting the admin UI

Set `ADMIN_PASSWORD` (and optionally `ADMIN_USER`, default `admin`) in `.env.local` to require sign-in at `/login`.
Unauthenticated page requests are redirected there; admin API requests return `401`. `/api/verify` always stays public.

Sessions are signed HMAC cookies and last 7 days. Set `AUTH_SECRET` to sign them independently of the password
(if unset, `ADMIN_PASSWORD` is used). HTTP Basic auth is still accepted for scripts. Do this before exposing the
app beyond your own machine. See `.env.example`.

The built-in administrator is always `ADMIN_USER` / `ADMIN_PASSWORD`. Additional users can be created in **Settings**;
they are saved in the `users` table and their passwords are stored only as scrypt hashes (never plain text), so they
survive restarts and redeploys.

Use single quotes for env values containing `#` or `$`, and escape a literal `$` as `\$` — Next expands variables
in env files and otherwise truncates the value at `#`.

## Customising

Products, client types, pricing models and key terms live in `lib/constants.js`.

## Storage

All storage code is in `lib/db.js`. Three tables are created automatically on first use:

| Table          | Holds                                                                 |
| -------------- | --------------------------------------------------------------------- |
| `users`        | username, scrypt `password_hash`, created date (accounts that sign in) |
| `clients`      | name, type, register date, description, pricing model, SaaS            |
| `license_keys` | SHA-256 `key_hash`, last 4 characters, term, status dates, revoked flag |

Because keys are stored only as hashes, they cannot be regenerated: losing the database means losing every key you
issued. Use Neon's backups/branches before any destructive change.

`DATABASE_URL` is a secret. Keep it in `.env.local` or the host's environment variables, never in the repo.
If it is ever exposed, rotate the password in the Neon console and update the variable everywhere.

The **Settings** page saves your light/dark choice in the browser (`localStorage`), not in the database.
