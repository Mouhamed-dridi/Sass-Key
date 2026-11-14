import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "LicenseHub",
  description: "Generate and track license keys for your SaaS clients.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
