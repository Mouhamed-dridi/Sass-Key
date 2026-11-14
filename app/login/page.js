import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { SESSION_COOKIE, isAuthEnabled, verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in · LicenseHub",
};

export default async function LoginPage({ searchParams }) {
  // With no password configured the app is open, so there is nothing to sign in to.
  if (!isAuthEnabled()) redirect("/");

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) redirect("/");

  const params = await searchParams;
  const requested = typeof params?.next === "string" ? params.next : "/";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/\\")
      ? requested
      : "/";

  return <LoginForm next={next} />;
}
