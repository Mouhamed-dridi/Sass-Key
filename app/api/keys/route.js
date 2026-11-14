import { NextResponse } from "next/server";
import { LICENSE_TYPES, SAAS_LIST, getLicenseType } from "@/lib/constants";
import { getClient, insertKey } from "@/lib/db";
import { generateKey, hashKey, last4 } from "@/lib/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const licenseType = getLicenseType(body?.type);
  if (!licenseType) {
    return NextResponse.json(
      { error: `Choose a license type (${LICENSE_TYPES.map((t) => t.code).join(", ")}).` },
      { status: 400 },
    );
  }
  if (!SAAS_LIST.includes(body?.saas)) {
    return NextResponse.json({ error: "Choose a valid SaaS." }, { status: 400 });
  }
  const client = getClient(Number(body?.client_id));
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 400 });
  }

  // A collision on a 100-bit random key is practically impossible; retry anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateKey(licenseType.code);
    try {
      const id = insertKey({
        client_id: client.id,
        saas: body.saas,
        type: licenseType.code,
        key_hash: hashKey(key),
        last4: last4(key),
      });
      // This response is the only time the plain key ever exists.
      return NextResponse.json(
        {
          id,
          key,
          type: licenseType.code,
          label: licenseType.label,
          saas: body.saas,
          client_name: client.name,
        },
        { status: 201, headers: NO_STORE },
      );
    } catch (err) {
      if (err?.code !== "DUPLICATE_KEY") throw err;
    }
  }
  return NextResponse.json({ error: "Could not generate a unique key." }, { status: 500 });
}
