"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Lock } from "lucide-react";
import Link from "next/link";

const AUTH_COOKIE = "paraiso_admin_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Invalid password");
        setLoading(false);
        return;
      }

      document.cookie = `${AUTH_COOKIE}=${data.token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
      router.push(from);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-100 to-teal-50/30 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/60 bg-white/90 p-8 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white">
              <MapPin className="h-6 w-6" />
            </div>
            <span className="text-xl font-semibold text-stone-800">
              Paraíso Tours
            </span>
          </div>
          <h1 className="mt-8 text-2xl font-bold text-stone-900">Staff login</h1>
          <p className="mt-1 text-stone-600">
            Enter your password to access the admin portal
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-stone-700"
              >
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="Enter password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-600 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-70"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            <Link href="/" className="text-teal-600 hover:text-teal-700">
              ← Back to client portal
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          Set ADMIN_PASSWORD in .env.local for production
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" /></div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
