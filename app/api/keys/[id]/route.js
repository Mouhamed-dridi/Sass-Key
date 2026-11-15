import { NextResponse } from "next/server";
import { setRevoked } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH { "revoked": true | false }
export async function PATCH(request, { params }) {
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body?.revoked !== "boolean") {
    return NextResponse.json({ error: '"revoked" must be true or false.' }, { status: 400 });
  }

  const found = await setRevoked(Number(id), body.revoked);
  if (!found) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
