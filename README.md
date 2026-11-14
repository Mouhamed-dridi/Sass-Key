# LicenseHub

Small admin app for generating and tracking license keys for the SaaS products you deliver to clients.
Next.js + DaisyUI. For testing, all data is kept in one plain text file (`data/db.txt`); swap in a real database later (see "Storage").

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
# production:
npm run build && npm start
```

Needs Node 20+. The data file is created on first use at `data/db.txt` (override with `DB_PATH`).

## What's in it

- **Dashboard**: client / key counts and recent activity.
- **Clients**: table plus an "Add client" pop-up (name, type, register date, description, pricing model, SaaS).
- **Key Generator**: choose client, SaaS and term, generate. The full key is shown once.

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

Use single quotes for env values containing `#` or `$`, and escape a literal `$` as `\$` — Next expands variables
in env files and otherwise truncates the value at `#`.

## Customising

Products, client types, pricing models and key terms live in `lib/constants.js`.

## Storage (test setup)

All clients and keys live in `lib/db.js`, which reads and writes one text file (JSON inside).
Only key hashes are stored. Because keys are hashed, losing the file means losing every key you issued
(they cannot be regenerated from the hashes), so back it up if the data matters.

**Netlify and other serverless hosts:** the code folder is read-only there, so the app automatically falls back to
the OS temp folder. That copy is **temporary**: it is wiped on restarts and is not shared between server instances,
so clients and keys will disappear. Fine for a demo, not for real licenses.

**Moving to a real database:** replace the functions exported from `lib/db.js` (`listClients`, `getClient`,
`createClient`, `listKeys`, `insertKey`, `setRevoked`, `verifyLicense`, `getStats`). Nothing else in the app
touches the storage. They are synchronous now; a real database makes them async, so add `await` where they are called.
