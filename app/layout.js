import "./globals.css";
import AppShell from "@/components/AppShell";
import { THEME_SCRIPT } from "@/lib/theme";

export const metadata = {
  title: "LicenseHub",
  description: "Generate and track license keys for your SaaS clients.",
};

export default function RootLayout({ children }) {
  return (
    // The inline script below sets data-theme before hydration, so the
    // server-rendered <html> attribute is expected to differ.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
