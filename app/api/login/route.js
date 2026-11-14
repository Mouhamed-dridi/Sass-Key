import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  getAdminUser,
  isAuthEnabled,
  safeEqual,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: "Login is not configured. Set ADMIN_PASSWORD." },
      { status: 503, headers: NO_STORE },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: NO_STORE });
  }

  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const [userOk, passwordOk] = await Promise.all([
    safeEqual(username, getAdminUser()),
    safeEqual(password, process.env.ADMIN_PASSWORD),
  ]);

  if (!userOk || !passwordOk) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401, headers: NO_STORE },
    );
  }

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return response;
}
