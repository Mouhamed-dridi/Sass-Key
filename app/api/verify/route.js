import { NextResponse } from "next/server";
import { verifyLicense } from "@/lib/db";
import { KEY_LENGTH, hashKey, normalizeKey } from "@/lib/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Public endpoint for your SaaS apps.
// POST { "key": "Y-XXXX-XXXX-XXXX-XXXX-XXXX", "saas": "ParkingPlus" }   (saas is optional)
// -> { valid: true, saas, type, client, activated_at, expires_at }
// -> { valid: false, reason: "invalid_key" | "wrong_product" | "revoked" | "expired" }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, reason: "bad_request" }, { status: 400 });
  }

  if (typeof body?.key !== "string" || !body.key.trim()) {
    return NextResponse.json({ valid: false, reason: "missing_key" }, { status: 400 });
  }
  if (normalizeKey(body.key).length !== KEY_LENGTH) {
    return NextResponse.json({ valid: false, reason: "invalid_key" }, { headers: NO_STORE });
  }

  const saas = typeof body.saas === "string" ? body.saas : undefined;
  const result = verifyLicense(hashKey(body.key), saas);
  return NextResponse.json(result, { headers: NO_STORE });
}
