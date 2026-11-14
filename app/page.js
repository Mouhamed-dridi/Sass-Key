import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { KeyIcon } from "@/components/Icons";
import { getLicenseType } from "@/lib/constants";
import { getStats, listClients, listKeys } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = getStats();
  const recentClients = listClients().slice(0, 5);
  const recentKeys = listKeys().slice(0, 5);

  const cards = [
    { label: "Clients", value: stats.clients, note: "registered" },
    { label: "Keys issued", value: stats.keys, note: `${stats.active} active` },
    { label: "Unused keys", value: stats.unused, note: "waiting for first use" },
    { label: "Expiring soon", value: stats.expiringSoon, note: "within 30 days" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your clients and licenses.">
        <Link href="/generator" className="btn btn-primary">
          <KeyIcon />
          Generate key
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm opacity-70">{c.label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{c.value}</div>
            <div className="text-xs opacity-60">{c.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-box border border-base-300">
          <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
            <h2 className="font-semibold">Recent clients</h2>
            <Link href="/clients" className="link link-hover text-sm">
              View all
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <p className="p-4 text-sm opacity-70">
              No clients yet. <Link href="/clients" className="link">Add your first client</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>SaaS</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClients.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td>
                        <span className="badge badge-primary badge-soft">{c.saas}</span>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(c.registered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-box border border-base-300">
          <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
            <h2 className="font-semibold">Recent keys</h2>
            <Link href="/generator" className="link link-hover text-sm">
              View all
            </Link>
          </div>
          {recentKeys.length === 0 ? (
            <p className="p-4 text-sm opacity-70">
              No keys yet. <Link href="/generator" className="link">Generate one</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>SaaS</th>
                    <th>Term</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentKeys.map((k) => (
                    <tr key={k.id}>
                      <td className="font-medium">{k.client_name}</td>
                      <td>{k.saas}</td>
                      <td className="whitespace-nowrap">{getLicenseType(k.type)?.label}</td>
                      <td>
                        <StatusBadge status={k.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
