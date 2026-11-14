// Shared auth helpers for the login page, route handlers, and proxy.js.
// Uses Web Crypto so the same code works in the Node and proxy runtimes.

export const SESSION_COOKIE = "licensehub_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function isAuthEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function getAdminUser() {
  return process.env.ADMIN_USER || "admin";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

function getSecret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "";
}

let keyPromise;
function getKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))),
  );
}

/** Compares two strings without leaking their contents through early exit. */
export async function safeEqual(a, b) {
  const [left, right] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function createSessionToken() {
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        sub: getAdminUser(),
        exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getKey(),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token) {
  if (typeof token !== "string") return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      base64UrlDecode(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return false;

    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return data?.sub === getAdminUser() && Number(data?.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
