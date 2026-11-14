import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getLicenseType } from "./constants";
import { addMonths } from "./keys";

// ---------------------------------------------------------------------------
// TEST STORAGE: everything lives in one text file (JSON inside), db.txt.
//
// Only SHA-256 hashes of keys are stored, never the keys themselves.
//
// To move to a real database later, replace the functions exported below.
// Their names and return shapes are all the rest of the app depends on.
//
// Where the file lives:
//   1. DB_PATH if set, else ./data/db.txt
//   2. If that location is read-only (e.g. Netlify serverless functions), the
//      OS temp folder is used instead. That copy is TEMPORARY: it is wiped on
//      restarts and is not shared between server instances.
// ---------------------------------------------------------------------------

const FILE_NAME = "db.txt";
let resolvedPath;

function canWrite(file) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, ""); // creates the file if missing
    return true;
  } catch {
    return false;
  }
}

function getPath() {
  if (resolvedPath) return resolvedPath;
  const preferred = process.env.DB_PATH || path.join(process.cwd(), "data", FILE_NAME);
  if (canWrite(preferred)) {
    resolvedPath = preferred;
  } else {
    resolvedPath = path.join(os.tmpdir(), `licensehub-${FILE_NAME}`);
    console.warn(
      `[db] ${preferred} is not writable. Using ${resolvedPath} instead: data there is temporary.`,
    );
  }
  return resolvedPath;
}

function load() {
  let raw = "";
  try {
    raw = fs.readFileSync(getPath(), "utf8").trim();
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  if (!raw) return { clients: [], keys: [], users: [] };
  const data = JSON.parse(raw); // a corrupt file throws instead of being silently wiped
  return { clients: data.clients ?? [], keys: data.keys ?? [], users: data.users ?? [] };
}

function save(data) {
  const file = getPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // atomic replace, so a crash can't leave half a file
}

const nextId = (rows) => rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

/** unused -> active (after first verify) -> expired, or revoked at any point. */
export function keyStatus(row, now = new Date()) {
  if (row.revoked) return "revoked";
  if (!row.activated_at) return "unused";
  if (new Date(row.expires_at) <= now) return "expired";
  return "active";
}

// ---------- clients ----------

export function listClients() {
  const { clients, keys } = load();
  return clients
    .map((c) => ({ ...c, key_count: keys.filter((k) => k.client_id === c.id).length }))
    .sort((a, b) => b.id - a.id);
}

export function getClient(id) {
  return load().clients.find((c) => c.id === id);
}

export function createClient(client) {
  const data = load();
  const row = { id: nextId(data.clients), ...client, created_at: new Date().toISOString() };
  data.clients.push(row);
  save(data);
  return row;
}

// ---------- users ----------

/** Safe for the UI: never returns password_hash. */
export function listUsers() {
  return load()
    .users.map(({ id, username, created_at }) => ({ id, username, created_at }))
    .sort((a, b) => b.id - a.id);
}

/** Internal lookup used by the login route; includes password_hash. */
export function findUserByUsername(username) {
  const key = String(username ?? "").trim().toLowerCase();
  if (!key) return null;
  return load().users.find((user) => user.username === key) ?? null;
}

export function createUser({ username, password_hash }) {
  const data = load();
  const key = String(username ?? "").trim().toLowerCase();
  if (!key) throw Object.assign(new Error("Username is required"), { code: "INVALID_USERNAME" });
  if (data.users.some((user) => user.username === key)) {
    throw Object.assign(new Error("Username already exists"), { code: "DUPLICATE_USER" });
  }

  const row = {
    id: nextId(data.users),
    username: key,
    password_hash,
    created_at: new Date().toISOString(),
  };
  data.users.push(row);
  save(data);
  return { id: row.id, username: row.username, created_at: row.created_at };
}

// ---------- license keys ----------

/** Never returns key_hash. Safe to pass to the UI. */
export function listKeys() {
  const { clients, keys } = load();
  const now = new Date();
  return keys
    .map((k) => ({
      id: k.id,
      client_id: k.client_id,
      client_name: clients.find((c) => c.id === k.client_id)?.name ?? "(deleted client)",
      saas: k.saas,
      type: k.type,
      last4: k.last4,
      months: k.months,
      revoked: k.revoked,
      created_at: k.created_at,
      activated_at: k.activated_at,
      expires_at: k.expires_at,
      status: keyStatus(k, now),
    }))
    .sort((a, b) => b.id - a.id);
}

export function insertKey({ client_id, saas, type, key_hash, last4 }) {
  const data = load();
  if (data.keys.some((k) => k.key_hash === key_hash)) {
    throw Object.assign(new Error("Duplicate key"), { code: "DUPLICATE_KEY" });
  }
  const id = nextId(data.keys);
  data.keys.push({
    id,
    client_id,
    saas,
    type,
    key_hash,
    last4,
    months: getLicenseType(type).months,
    revoked: 0,
    created_at: new Date().toISOString(),
    activated_at: null,
    expires_at: null,
  });
  save(data);
  return id;
}

export function setRevoked(id, revoked) {
  const data = load();
  const key = data.keys.find((k) => k.id === id);
  if (!key) return false;
  key.revoked = revoked ? 1 : 0;
  save(data);
  return true;
}

/**
 * Checks a key by its hash. The first successful check activates the key and
 * starts its term (expires_at = now + months).
 */
export function verifyLicense(keyHash, saas) {
  const data = load();
  const key = data.keys.find((k) => k.key_hash === keyHash);

  if (!key) return { valid: false, reason: "invalid_key" };
  if (saas && key.saas.toLowerCase() !== String(saas).toLowerCase()) {
    return { valid: false, reason: "wrong_product" };
  }
  if (key.revoked) return { valid: false, reason: "revoked" };

  const now = new Date();
  if (!key.activated_at) {
    key.activated_at = now.toISOString();
    key.expires_at = addMonths(now, key.months).toISOString();
    save(data);
  }

  if (new Date(key.expires_at) <= now) {
    return { valid: false, reason: "expired", expires_at: key.expires_at };
  }
  return {
    valid: true,
    saas: key.saas,
    type: key.type,
    client: data.clients.find((c) => c.id === key.client_id)?.name ?? "",
    activated_at: key.activated_at,
    expires_at: key.expires_at,
  };
}

// ---------- dashboard ----------

export function getStats() {
  const keys = listKeys();
  const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return {
    clients: load().clients.length,
    keys: keys.length,
    active: keys.filter((k) => k.status === "active").length,
    unused: keys.filter((k) => k.status === "unused").length,
    expiringSoon: keys.filter(
      (k) => k.status === "active" && new Date(k.expires_at).getTime() <= in30Days,
    ).length,
  };
}
