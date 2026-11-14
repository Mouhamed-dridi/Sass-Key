import { NextResponse } from "next/server";
import { SESSION_COOKIE, isAuthEnabled, safeEqual, verifySessionToken } from "@/lib/auth";

// Optional auth for the admin UI, active only when ADMIN_PASSWORD is set.
// Page requests redirect to /login; admin API requests get a 401 JSON response.
// /api/verify is excluded so SaaS apps can always validate keys.
// HTTP Basic auth is still accepted for scripts and integrations.
export async function proxy(request) {
  if (!isAuthEnabled()) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) return NextResponse.next();
  if (await hasValidBasicAuth(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

async function hasValidBasicAuth(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;

    const [userOk, passwordOk] = await Promise.all([
      safeEqual(decoded.slice(0, separator), process.env.ADMIN_USER || "admin"),
      safeEqual(decoded.slice(separator + 1), process.env.ADMIN_PASSWORD),
    ]);
    return userOk && passwordOk;
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    "/((?!api/verify|api/login|api/logout|login|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
