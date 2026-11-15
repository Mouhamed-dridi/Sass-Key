import pg from "pg";
import { getLicenseType } from "./constants";
import { addMonths } from "./keys";

// ---------------------------------------------------------------------------
// Storage: PostgreSQL (Neon). The connection string comes from DATABASE_URL
// and must never be written into the repo.
//
// Three tables are created automatically on first use:
//   users         accounts that can sign in (password_hash is a scrypt hash)
//   clients       the people/companies you issue licenses to
//   license_keys  only the SHA-256 hash of each key, never the key itself
//
// Everything below is async. Callers must `await` it.
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS clients (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL,
    registered_at DATE NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    pricing_model TEXT NOT NULL,
    saas          TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS license_keys (
    id           SERIAL PRIMARY KEY,
    client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    saas         TEXT NOT NULL,
    type         TEXT NOT NULL,
    key_hash     TEXT NOT NULL UNIQUE,
    last4        TEXT NOT NULL,
    months       INTEGER NOT NULL,
    revoked      BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ
  );
`;

const SCHEMA_LOCK_ID = 727274; // arbitrary app-wide number for the advisory lock
const MAX_INT = 2147483647;

// Hand dates/timestamps to the UI as plain strings (as the app always did):
// DATE -> "2026-11-15", TIMESTAMPTZ -> ISO 8601.
const TYPE_PARSERS = {
  getTypeParser(oid, format) {
    if (oid === 1082) return (value) => value;
    if (oid === 1184) return (value) => new Date(value).toISOString();
    return pg.types.getTypeParser(oid, format);
  },
};

function connectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env.local (local) " +
        "or to the site's environment variables (Netlify).",
    );
  }
  // node-postgres can't do channel binding; the connection is still TLS + password
  // authenticated without it, so drop the parameter Neon adds to its URLs.
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  // Keep full certificate verification explicit (Neon has valid public certificates).
  if (url.searchParams.get("sslmode") === "require") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

// One pool per server instance (survives hot reloads in dev).
function getPool() {
  if (!globalThis.__licensePool) {
    globalThis.__licensePool = new pg.Pool({
      connectionString: connectionString(),
      types: TYPE_PARSERS,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000, // Neon may need a few seconds to wake up
      allowExitOnIdle: true,
    });
  }
  return globalThis.__licensePool;
}

async function createTables() {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Several serverless instances can start at once; serialize table creation.
    await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK_ID]);
    await client.query(SCHEMA);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function query(text, params) {
  if (!globalThis.__licenseSchema) {
    globalThis.__licenseSchema = createTables().catch((err) => {
      globalThis.__licenseSchema = undefined; // try again on the next request
      throw err;
    });
  }
  await globalThis.__licenseSchema;
  return getPool().query(text, params);
}

const isId = (value) => Number.isInteger(value) && value > 0 && value <= MAX_INT;
const UNIQUE_VIOLATION = "23505";

/** unused -> active (after first verify) -> expired, or revoked at any point. */
export function keyStatus(row, now = new Date()) {
  if (row.revoked) return "revoked";
  if (!row.activated_at) return "unused";
  if (new Date(row.expires_at) <= now) return "expired";
  return "active";
}

// ---------- clients ----------

export async function listClients() {
  const { rows } = await query(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM license_keys k WHERE k.client_id = c.id) AS key_count
       FROM clients c
      ORDER BY c.id DESC`,
  );
  return rows;
}

export async function getClient(id) {
  if (!isId(id)) return undefined;
  const { rows } = await query("SELECT * FROM clients WHERE id = $1", [id]);
  return rows[0];
}

export async function createClient(client) {
  const { rows } = await query(
    `INSERT INTO clients (name, type, registered_at, description, pricing_model, saas)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      client.name,
      client.type,
      client.registered_at,
      client.description,
      client.pricing_model,
      client.saas,
    ],
  );
  return rows[0];
}

// ---------- users ----------

/** Safe for the UI: never returns password_hash. */
export async function listUsers() {
  const { rows } = await query("SELECT id, username, created_at FROM users ORDER BY id DESC");
  return rows;
}

/** Internal lookup used by the login route; includes password_hash. */
export async function findUserByUsername(username) {
  const key = String(username ?? "").trim().toLowerCase();
  if (!key) return null;
  const { rows } = await query("SELECT * FROM users WHERE username = $1", [key]);
  return rows[0] ?? null;
}

export async function createUser({ username, password_hash }) {
  const key = String(username ?? "").trim().toLowerCase();
  if (!key) throw Object.assign(new Error("Username is required"), { code: "INVALID_USERNAME" });
  try {
    const { rows } = await query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, created_at`,
      [key, password_hash],
    );
    return rows[0];
  } catch (err) {
    if (err?.code === UNIQUE_VIOLATION) {
      throw Object.assign(new Error("Username already exists"), { code: "DUPLICATE_USER" });
    }
    throw err;
  }
}

// ---------- license keys ----------

/** Never returns key_hash. Safe to pass to the UI. */
export async function listKeys() {
  const { rows } = await query(
    `SELECT k.id, k.client_id, k.saas, k.type, k.last4, k.months, k.revoked,
            k.created_at, k.activated_at, k.expires_at,
            c.name AS client_name
       FROM license_keys k
       JOIN clients c ON c.id = k.client_id
      ORDER BY k.id DESC`,
  );
  const now = new Date();
  return rows.map((row) => ({ ...row, status: keyStatus(row, now) }));
}

export async function insertKey({ client_id, saas, type, key_hash, last4 }) {
  try {
    const { rows } = await query(
      `INSERT INTO license_keys (client_id, saas, type, key_hash, last4, months)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [client_id, saas, type, key_hash, last4, getLicenseType(type).months],
    );
    return rows[0].id;
  } catch (err) {
    if (err?.code === UNIQUE_VIOLATION) {
      throw Object.assign(new Error("Duplicate key"), { code: "DUPLICATE_KEY" });
    }
    throw err;
  }
}

export async function setRevoked(id, revoked) {
  if (!isId(id)) return false;
  const result = await query("UPDATE license_keys SET revoked = $2 WHERE id = $1", [
    id,
    Boolean(revoked),
  ]);
  return result.rowCount > 0;
}

/**
 * Checks a key by its hash. The first successful check activates the key and
 * starts its term (expires_at = now + months).
 */
export async function verifyLicense(keyHash, saas) {
  const { rows } = await query(
    `SELECT k.*, c.name AS client_name
       FROM license_keys k
       JOIN clients c ON c.id = k.client_id
      WHERE k.key_hash = $1`,
    [keyHash],
  );
  const key = rows[0];

  if (!key) return { valid: false, reason: "invalid_key" };
  if (saas && key.saas.toLowerCase() !== String(saas).toLowerCase()) {
    return { valid: false, reason: "wrong_product" };
  }
  if (key.revoked) return { valid: false, reason: "revoked" };

  const now = new Date();
  let { activated_at, expires_at } = key;
  if (!activated_at) {
    // "AND activated_at IS NULL" makes first use atomic: if two requests race,
    // only one sets the term and the other reads the winner's values.
    const activated = await query(
      `UPDATE license_keys
          SET activated_at = $2, expires_at = $3
        WHERE id = $1 AND activated_at IS NULL
        RETURNING activated_at, expires_at`,
      [key.id, now.toISOString(), addMonths(now, key.months).toISOString()],
    );
    if (activated.rows[0]) {
      ({ activated_at, expires_at } = activated.rows[0]);
    } else {
      const current = await query(
        "SELECT activated_at, expires_at FROM license_keys WHERE id = $1",
        [key.id],
      );
      ({ activated_at, expires_at } = current.rows[0]);
    }
  }

  if (new Date(expires_at) <= now) {
    return { valid: false, reason: "expired", expires_at };
  }
  return {
    valid: true,
    saas: key.saas,
    type: key.type,
    client: key.client_name,
    activated_at,
    expires_at,
  };
}

// ---------- dashboard ----------

export async function getStats() {
  const [keys, clients] = await Promise.all([
    listKeys(),
    query("SELECT COUNT(*)::int AS n FROM clients"),
  ]);
  const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return {
    clients: clients.rows[0].n,
    keys: keys.length,
    active: keys.filter((k) => k.status === "active").length,
    unused: keys.filter((k) => k.status === "unused").length,
    expiringSoon: keys.filter(
      (k) => k.status === "active" && new Date(k.expires_at).getTime() <= in30Days,
    ).length,
  };
}
