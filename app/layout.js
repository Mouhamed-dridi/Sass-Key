import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { MenuIcon } from "@/components/Icons";

export const metadata = {
  title: "LicenseHub",
  description: "Generate and track license keys for your SaaS clients.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="drawer lg:drawer-open">
          <input id="nav-drawer" type="checkbox" className="drawer-toggle" />

          <div className="drawer-content flex min-h-screen flex-col bg-base-100">
            <div className="navbar border-b border-base-300 bg-base-100 lg:hidden">
              <label htmlFor="nav-drawer" className="btn btn-ghost btn-square" aria-label="Open menu">
                <MenuIcon />
              </label>
              <span className="px-2 font-semibold">LicenseHub</span>
            </div>
            <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
          </div>

          <div className="drawer-side z-40">
            <label htmlFor="nav-drawer" aria-label="Close menu" className="drawer-overlay" />
            <Sidebar />
          </div>
        </div>
      </body>
    </html>
  );
}
