"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { CheckIcon, CopyIcon, KeyIcon } from "@/components/Icons";
import { LICENSE_TYPES, SAAS_LIST, getLicenseType } from "@/lib/constants";
import { formatDate, maskedKey } from "@/lib/format";

export default function GeneratorView({ clients, keys }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [saas, setSaas] = useState(SAAS_LIST[0]);
  const [type, setType] = useState(LICENSE_TYPES[0].code);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [tableError, setTableError] = useState("");

  function onClientChange(id) {
    setClientId(id);
    const client = clients.find((c) => String(c.id) === id);
    if (client) setSaas(client.saas); // default to the client's SaaS, still editable
  }

  async function generate(e) {
    e.preventDefault();
    setError("");
    setCopied(false);
    if (!clientId) {
      setError("Choose a client first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: Number(clientId), saas, type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not generate the key.");
      setResult(json);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(result.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't access the clipboard. Select the key and copy it manually.");
    }
  }

  async function toggleRevoke(k) {
    const revoke = !k.revoked;
    if (
      revoke &&
      !window.confirm(`Revoke this key for ${k.client_name}? It will stop validating immediately.`)
    ) {
      return;
    }
    setTableError("");
    setBusyId(k.id);
    try {
      const res = await fetch(`/api/keys/${k.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoked: revoke }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed.");
      router.refresh();
    } catch (err) {
      setTableError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Key Generator" subtitle="Pick a client, a SaaS and a term, then generate." />

      {clients.length === 0 ? (
        <div role="alert" className="alert alert-info alert-soft">
          <span>
            You need at least one client before generating keys.{" "}
            <Link href="/clients" className="link font-medium">
              Add a client
            </Link>
          </span>
        </div>
      ) : (
        <form onSubmit={generate} className="rounded-box border border-base-300 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Client</legend>
              <select
                className="select w-full"
                value={clientId}
                onChange={(e) => onClientChange(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a client…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">SaaS</legend>
              <select className="select w-full" value={saas} onChange={(e) => setSaas(e.target.value)}>
                {SAAS_LIST.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </fieldset>
          </div>

          <fieldset className="fieldset mt-4">
            <legend className="fieldset-legend">License term</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {LICENSE_TYPES.map((t) => {
                const selected = type === t.code;
                return (
                  <label
                    key={t.code}
                    className={`cursor-pointer rounded-box border p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setType(t.code)}
                    />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{t.label}</span>
                      <span className="badge badge-neutral font-mono">{t.code}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs opacity-70">{t.code}-XXXX-XXXX-XXXX-XXXX-XXXX</p>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="alert alert-error alert-soft mt-4">
              {error}
            </div>
          )}

          <div className="mt-5">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : <KeyIcon />}
              Generate key
            </button>
          </div>
        </form>
      )}

      {result && (
        <section
          role="status"
          className="mt-6 rounded-box border-2 border-success bg-success/5 p-5"
        >
          <h2 className="font-semibold">License key generated</h2>
          <p className="text-sm opacity-70">
            {result.client_name} · {result.saas} · {result.label}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="select-all break-all rounded-box border border-base-300 bg-base-100 px-4 py-3 font-mono text-lg tracking-wider">
              {result.key}
            </code>
            <button type="button" className="btn btn-primary" onClick={copyKey}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div role="alert" className="alert alert-warning alert-soft mt-4 text-base-content">
            Copy it now. Only a hash is stored, so this key can’t be shown again.
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Issued keys</h2>
        {tableError && (
          <div role="alert" className="alert alert-error alert-soft mb-3">
            {tableError}
          </div>
        )}
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>SaaS</th>
                <th>Term</th>
                <th>Key</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center opacity-70">
                    No keys generated yet.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.client_name}</td>
                    <td>{k.saas}</td>
                    <td className="whitespace-nowrap">{getLicenseType(k.type)?.label}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{maskedKey(k.type, k.last4)}</td>
                    <td>
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="whitespace-nowrap">{formatDate(k.created_at)}</td>
                    <td className="whitespace-nowrap">
                      {k.expires_at ? formatDate(k.expires_at) : <span className="opacity-60">On first use</span>}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className={`btn btn-xs ${k.revoked ? "btn-ghost" : "btn-error btn-soft"}`}
                        disabled={busyId === k.id}
                        onClick={() => toggleRevoke(k)}
                      >
                        {k.revoked ? "Restore" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
