"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyIcon } from "@/components/Icons";

export default function LoginForm({ next }) {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not sign in.");

      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-base-200 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-content">
            <KeyIcon />
          </span>
          <span className="text-2xl font-bold tracking-tight">LicenseHub</span>
        </div>

        <div className="card border border-base-300 bg-base-100 shadow-xl">
          <form onSubmit={onSubmit} className="card-body gap-4">
            <div>
              <h1 className="card-title text-xl">Sign in</h1>
              <p className="text-sm opacity-70">Admin access to clients and license keys.</p>
            </div>

            {error && (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                {error}
              </div>
            )}

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Username</legend>
              <input
                className="input w-full"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Password</legend>
              <div className="join w-full">
                <input
                  className="input join-item w-full"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="btn join-item"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </fieldset>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs opacity-60">
          Keys are stored as SHA-256 hashes and shown only once.
        </p>
      </div>
    </main>
  );
}
