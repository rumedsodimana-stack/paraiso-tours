"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { getSafeAdminNextPath } from "@/lib/admin-session";
import { APP_RELEASE } from "@/lib/app-release";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const nextPath = getSafeAdminNextPath(searchParams.get("next"));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(18,52,59,0.18),_transparent_36%),linear-gradient(180deg,#f7f0e5_0%,#efe5d6_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2.4rem] border border-white/50 bg-white/70 shadow-[0_40px_120px_-55px_rgba(28,31,36,0.42)] backdrop-blur-xl lg:grid-cols-[1fr_0.92fr]">
          <div className="hidden flex-col justify-between bg-[#12343b] px-10 py-12 text-[#f7ead7] lg:flex">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#e5c48e]">
                <ShieldCheck className="h-4 w-4" />
                Admin Access
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight">
                Operate bookings, tours, and finance from one place.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-[#e5dccd]">
                Sign in with the admin password to open the operations hub and
                continue managing the live Sri Lanka travel workflow.
              </p>
            </div>

            <div className="space-y-3 text-sm text-[#e5dccd]">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-4">
                Protected areas include bookings, supplier data, invoicing,
                payments, payroll, and settings.
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-4">
                Session access now uses an httpOnly admin cookie instead of the
                previous public redirect shortcut.
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-10 sm:py-12">
            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-[#fbf7f1] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8c6a38]">
                <LockKeyhole className="h-4 w-4" />
                Secure Login
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-stone-900">
                Sign in to admin
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Use the configured admin password to continue.
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
                Live version v{APP_RELEASE.version}
              </p>

              <form
                className="mt-8 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError("");
                  startTransition(async () => {
                    try {
                      const response = await fetch("/api/admin/auth", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password }),
                      });
                      const data = (await response.json().catch(() => null)) as
                        | { ok?: boolean; error?: string }
                        | null;

                      if (!response.ok || !data?.ok) {
                        setError(data?.error ?? "Unable to sign in");
                        return;
                      }

                      router.replace(nextPath);
                      router.refresh();
                    } catch {
                      setError("Unable to sign in");
                    }
                  });
                }}
              >
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-stone-700"
                  >
                    Admin password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-[1.2rem] border border-[#ddc8b0] bg-white px-4 py-3 text-stone-900 outline-none transition focus:border-[#12343b] focus:ring-4 focus:ring-[#12343b]/10"
                  />
                </div>

                {error ? (
                  <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#12343b] px-5 py-3.5 text-sm font-semibold text-[#f6ead6] shadow-[0_18px_48px_-28px_rgba(18,52,59,0.92)] transition hover:bg-[#0f2b31] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? "Signing in…" : "Enter admin"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="rounded-[1rem] border border-[#e6dac6] bg-[#fbf7f1] px-4 py-3 text-sm text-stone-600">
                  After login, users are notified about the current deployed
                  version once for this release, and all live booking data stays
                  preserved.
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
