import { NextResponse } from "next/server";
import { createClient } from "@/lib/db";
import { parseClientInput } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { value, error } = parseClientInput(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const client = await createClient(value);
  return NextResponse.json({ client }, { status: 201 });
}
