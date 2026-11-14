"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { PlusIcon, SearchIcon } from "@/components/Icons";
import { CLIENT_TYPES, PRICING_MODELS, SAAS_LIST } from "@/lib/constants";
import { formatDate } from "@/lib/format";

function localToday() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export default function ClientsView({ clients }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.type, c.saas, c.pricing_model, c.description].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [clients, query]);

  function openModal() {
    setError("");
    const dateInput = formRef.current?.elements.namedItem("registered_at");
    if (dateInput && !dateInput.value) dateInput.value = localToday();
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save the client.");

      form.reset();
      closeModal();
      setToast(`Client "${json.client.name}" added.`);
      setTimeout(() => setToast(""), 3500);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Clients" subtitle="Everyone you deliver a SaaS to.">
        <button type="button" className="btn btn-primary" onClick={openModal}>
          <PlusIcon />
          Add client
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="input w-full sm:max-w-xs">
          <SearchIcon className="size-4 opacity-60" />
          <input
            type="search"
            placeholder="Search clients"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search clients"
          />
        </label>
        <span className="text-sm opacity-70">
          {filtered.length} of {clients.length} {clients.length === 1 ? "client" : "clients"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Type</th>
              <th>SaaS</th>
              <th>Pricing model</th>
              <th>Registered</th>
              <th className="text-right">Keys</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center opacity-70">
                  {clients.length === 0
                    ? "No clients yet. Click “Add client” to register your first one."
                    : "No clients match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.name}</div>
                    {c.description && (
                      <div className="line-clamp-2 max-w-md text-sm opacity-60" title={c.description}>
                        {c.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-ghost">{c.type}</span>
                  </td>
                  <td>
                    <span className="badge badge-primary badge-soft">{c.saas}</span>
                  </td>
                  <td className="whitespace-nowrap">{c.pricing_model}</td>
                  <td className="whitespace-nowrap">{formatDate(c.registered_at)}</td>
                  <td className="text-right tabular-nums">{c.key_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add-client pop-up form */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-xl">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3" aria-label="Close">
              ✕
            </button>
          </form>
          <h3 className="text-lg font-bold">New client</h3>

          <form ref={formRef} onSubmit={onSubmit} className="mt-4 grid gap-4">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Client name</legend>
              <input
                name="name"
                className="input w-full"
                placeholder="Acme Logistics"
                maxLength={120}
                required
              />
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Type</legend>
                <select name="type" className="select w-full" defaultValue={CLIENT_TYPES[0]}>
                  {CLIENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">Register date</legend>
                <input name="registered_at" type="date" className="input w-full" required />
              </fieldset>
            </div>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Description</legend>
              <textarea
                name="description"
                className="textarea h-24 w-full"
                placeholder="Optional notes about this client"
                maxLength={1000}
              />
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Pricing model</legend>
                <select name="pricing_model" className="select w-full" defaultValue={PRICING_MODELS[0]}>
                  {PRICING_MODELS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">SaaS</legend>
                <select name="saas" className="select w-full" defaultValue={SAAS_LIST[0]}>
                  {SAAS_LIST.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </fieldset>
            </div>

            {error && (
              <div role="alert" className="alert alert-error alert-soft">
                {error}
              </div>
            )}

            <div className="modal-action mt-2">
              <button type="button" className="btn" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving && <span className="loading loading-spinner loading-sm" />}
                Save client
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close">close</button>
        </form>
      </dialog>

      {toast && (
        <div className="toast toast-end z-50">
          <div role="status" className="alert alert-success">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
