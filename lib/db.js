import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getLicenseType } from "./constants";
import { addMonths } from "./keys";

// One SQLite file holds everything. (No WAL mode, so no extra -wal/-shm files.)
const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "licenses.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      pricing_model TEXT NOT NULL,
      saas          TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    -- Only the SHA-256 hash of each key is stored, never the key itself.
    CREATE TABLE IF NOT EXISTS license_keys (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      saas         TEXT NOT NULL,
      type         TEXT NOT NULL CHECK (type IN ('M', '3', 'Y')),
      key_hash     TEXT NOT NULL UNIQUE,
      last4        TEXT NOT NULL,
      months       INTEGER NOT NULL,
      revoked      INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL,
      activated_at TEXT,
      expires_at   TEXT
    );
  `);
  return db;
}

// Lazy singleton (survives hot reloads in dev, and nothing opens at build time).
function getDb() {
  if (!globalThis.__licenseDb) globalThis.__licenseDb = open();
  return globalThis.__licenseDb;
}

/** unused -> active (after first verify) -> expired, or revoked at any point. */
export function keyStatus(row, now = new Date()) {
  if (row.revoked) return "revoked";
  if (!row.activated_at) return "unused";
  if (new Date(row.expires_at) <= now) return "expired";
  return "active";
}

// ---------- clients ----------

export function listClients() {
  return getDb()
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM license_keys k WHERE k.client_id = c.id) AS key_count
         FROM clients c
        ORDER BY c.id DESC`,
    )
    .all();
}

export function getClient(id) {
  return getDb().prepare("SELECT * FROM clients WHERE id = ?").get(id);
}

export function createClient(client) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO clients (name, type, registered_at, description, pricing_model, saas, created_at)
       VALUES (@name, @type, @registered_at, @description, @pricing_model, @saas, @created_at)`,
    )
    .run({ ...client, created_at: new Date().toISOString() });
  return getClient(info.lastInsertRowid);
}

// ---------- license keys ----------

/** Never returns key_hash. Safe to pass to the UI. */
export function listKeys() {
  const rows = getDb()
    .prepare(
      `SELECT k.id, k.client_id, k.saas, k.type, k.last4, k.months, k.revoked,
              k.created_at, k.activated_at, k.expires_at,
              c.name AS client_name
         FROM license_keys k
         JOIN clients c ON c.id = k.client_id
        ORDER BY k.id DESC`,
    )
    .all();
  const now = new Date();
  return rows.map((r) => ({ ...r, status: keyStatus(r, now) }));
}

export function insertKey({ client_id, saas, type, key_hash, last4 }) {
  const months = getLicenseType(type).months;
  const info = getDb()
    .prepare(
      `INSERT INTO license_keys (client_id, saas, type, key_hash, last4, months, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(client_id, saas, type, key_hash, last4, months, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

export function setRevoked(id, revoked) {
  return (
    getDb()
      .prepare("UPDATE license_keys SET revoked = ? WHERE id = ?")
      .run(revoked ? 1 : 0, id).changes > 0
  );
}

/**
 * Checks a key by its hash. The first successful check activates the key and
 * starts its term (expires_at = now + months).
 */
export function verifyLicense(keyHash, saas) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT k.*, c.name AS client_name
         FROM license_keys k
         JOIN clients c ON c.id = k.client_id
        WHERE k.key_hash = ?`,
    )
    .get(keyHash);

  if (!row) return { valid: false, reason: "invalid_key" };
  if (saas && row.saas.toLowerCase() !== String(saas).toLowerCase()) {
    return { valid: false, reason: "wrong_product" };
  }
  if (row.revoked) return { valid: false, reason: "revoked" };

  const now = new Date();
  let { activated_at, expires_at } = row;
  if (!activated_at) {
    activated_at = now.toISOString();
    expires_at = addMonths(now, row.months).toISOString();
    db.prepare(
      "UPDATE license_keys SET activated_at = ?, expires_at = ? WHERE id = ? AND activated_at IS NULL",
    ).run(activated_at, expires_at, row.id);
  }

  if (new Date(expires_at) <= now) {
    return { valid: false, reason: "expired", expires_at };
  }
  return {
    valid: true,
    saas: row.saas,
    type: row.type,
    client: row.client_name,
    activated_at,
    expires_at,
  };
}

// ---------- dashboard ----------

export function getStats() {
  const keys = listKeys();
  const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return {
    clients: getDb().prepare("SELECT COUNT(*) AS n FROM clients").get().n,
    keys: keys.length,
    active: keys.filter((k) => k.status === "active").length,
    unused: keys.filter((k) => k.status === "unused").length,
    expiringSoon: keys.filter(
      (k) => k.status === "active" && new Date(k.expires_at).getTime() <= in30Days,
    ).length,
  };
}
