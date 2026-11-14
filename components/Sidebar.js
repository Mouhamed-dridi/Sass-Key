"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, KeyIcon, UsersIcon } from "@/components/Icons";

const ITEMS = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/clients", label: "Clients", Icon: UsersIcon },
  { href: "/generator", label: "Key Generator", Icon: KeyIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  // On mobile the sidebar is a drawer: close it after navigating.
  function closeDrawer() {
    const toggle = document.getElementById("nav-drawer");
    if (toggle) toggle.checked = false;
  }

  return (
    <aside className="flex min-h-full w-64 flex-col border-r border-base-300 bg-base-200">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-content">
          <KeyIcon />
        </span>
        <span className="text-lg font-bold tracking-tight">LicenseHub</span>
      </div>

      <ul className="menu w-full gap-1 px-3">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={closeDrawer}
                className={active ? "menu-active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto px-5 py-4 text-xs opacity-60">
        Keys are stored as SHA-256 hashes and shown only once.
      </p>
    </aside>
  );
}
