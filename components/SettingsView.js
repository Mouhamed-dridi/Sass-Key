"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@/components/Icons";
import { formatDate } from "@/lib/format";
import { applyTheme, readTheme } from "@/lib/theme";

export default function SettingsView({ users, adminUser }) {
  const router = useRouter();
  const [theme, setTheme] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  async function addUser(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not create the user.");

      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setToast(`User "${json.user.username}" added.`);
      setTimeout(() => setToast(""), 3500);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    { id: "built-in", username: adminUser, created_at: null, builtIn: true },
    ...users.map((user) => ({ ...user, builtIn: false })),
  ];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-box border border-base-300 p-5">
          <h2 className="font-semibold">Appearance</h2>
          <p className="mt-1 text-sm opacity-70">Choose how LicenseHub looks on this device.</p>

          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-box border border-base-300 p-4">
            <span>
              <span className="block font-medium">Dark mode</span>
              <span className="block text-sm opacity-70">Use the dark theme across the app.</span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={theme === "dark"}
              onChange={toggleTheme}
              aria-label="Enable dark mode"
            />
          </label>
        </section>

        <section className="rounded-box border border-base-300 p-5">
          <h2 className="font-semibold">Add user</h2>
          <p className="mt-1 text-sm opacity-70">
            Create another account that can sign in to the admin area.
          </p>

          <form onSubmit={addUser} className="mt-4 grid gap-4 sm:grid-cols-2">
            <fieldset className="fieldset sm:col-span-2">
              <legend className="fieldset-legend">Username</legend>
              <input
                className="input w-full"
                name="username"
                autoComplete="off"
                placeholder="e.g. sara"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={32}
                required
              />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Password</legend>
              <input
                className="input w-full"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={200}
                required
              />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Confirm password</legend>
              <input
                className="input w-full"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                maxLength={200}
                required
              />
            </fieldset>

            {error && (
              <div role="alert" className="alert alert-error alert-soft sm:col-span-2">
                {error}
              </div>
            )}

            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-sm" /> : <PlusIcon />}
                Add user
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Users</h2>
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Source</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.builtIn ? "built-in" : row.id}>
                  <td className="font-medium">{row.username}</td>
                  <td>
                    {row.builtIn ? (
                      <span className="badge badge-primary badge-soft">Built-in</span>
                    ) : (
                      <span className="badge badge-ghost">Added</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {row.created_at ? formatDate(row.created_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs opacity-60">
          The built-in administrator comes from <code>ADMIN_USER</code> / <code>ADMIN_PASSWORD</code>.
          Added users are stored in the app data file.
        </p>
      </section>

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
