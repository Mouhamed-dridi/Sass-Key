import { NextResponse } from "next/server";

// Optional HTTP Basic auth for the admin UI. Active only when ADMIN_PASSWORD is set.
// /api/verify is excluded so your SaaS apps can always validate keys.
export function proxy(request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.next();

  const user = process.env.ADMIN_USER || "admin";
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const i = decoded.indexOf(":");
      if (i > -1 && decoded.slice(0, i) === user && decoded.slice(i + 1) === password) {
        return NextResponse.next();
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LicenseHub"' },
  });
}

export const config = {
  matcher: ["/((?!api/verify|_next/static|_next/image|favicon.ico).*)"],
};
