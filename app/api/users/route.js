import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createUser, findUserByUsername } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { parseUserInput } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: NO_STORE });
  }

  const { value, error } = parseUserInput(body);
  if (error) return NextResponse.json({ error }, { status: 400, headers: NO_STORE });

  if (value.username === getAdminUser().toLowerCase()) {
    return NextResponse.json(
      { error: "That username is reserved for the built-in administrator." },
      { status: 409, headers: NO_STORE },
    );
  }
  if (findUserByUsername(value.username)) {
    return NextResponse.json(
      { error: "That username already exists." },
      { status: 409, headers: NO_STORE },
    );
  }

  try {
    const user = createUser({
      username: value.username,
      password_hash: hashPassword(value.password),
    });
    return NextResponse.json({ user }, { status: 201, headers: NO_STORE });
  } catch (err) {
    if (err?.code === "DUPLICATE_USER") {
      return NextResponse.json(
        { error: "That username already exists." },
        { status: 409, headers: NO_STORE },
      );
    }
    throw err;
  }
}
