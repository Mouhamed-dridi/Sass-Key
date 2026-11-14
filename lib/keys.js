import crypto from "node:crypto";
import { getLicenseType } from "./constants";

// 32 symbols (no I, O, 0, 1 to avoid look-alikes). 32 = 2^5, so `byte & 31`
// maps random bytes to symbols with no bias.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BODY_LENGTH = 20; // 20 symbols x 5 bits = 100 bits of randomness

/** Length of a key once dashes are removed: type character + random body. */
export const KEY_LENGTH = 1 + BODY_LENGTH;

/**
 * Format: <type>-XXXX-XXXX-XXXX-XXXX-XXXX
 * e.g.  Y-7KQ2-M9XA-TR4D-HW8N-C3PF
 */
export function generateKey(type) {
  if (!getLicenseType(type)) throw new Error(`Unknown license type: ${type}`);
  const bytes = crypto.randomBytes(BODY_LENGTH);
  let body = "";
  for (const byte of bytes) body += ALPHABET[byte & 31];
  return `${type}-${body.match(/.{4}/g).join("-")}`;
}

/** Case/dash/space-insensitive form of a key, used for hashing. */
export function normalizeKey(key) {
  return String(key ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** SHA-256 of the normalized key. This is all that gets stored. */
export function hashKey(key) {
  return crypto.createHash("sha256").update(normalizeKey(key)).digest("hex");
}

/** Last 4 characters, kept so a key can be recognised in the UI. */
export function last4(key) {
  return normalizeKey(key).slice(-4);
}

/** Calendar-month addition that clamps to the end of shorter months. */
export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0); // e.g. Jan 31 + 1 month -> Feb 28
  return d;
}
