"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

const IS_VERCEL = typeof window !== "undefined" && window.location?.hostname?.includes("vercel");

export function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus("error");
      setMessage("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("error");
      setMessage("New password and confirmation do not match");
      return;
    }
    if (newPassword.length < 6) {
      setStatus("error");
      setMessage("New password must be at least 6 characters");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setStatus("success");
        setMessage("Password changed successfully. Use the new password to log in.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to change password");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
          <KeyRound className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
            Change Admin Password
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Update your login password. {IS_VERCEL && "On Vercel, set ADMIN_PASSWORD in Project Settings instead."}
          </p>
        </div>
      </div>

      {IS_VERCEL ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800">
          <strong>Vercel deployment:</strong> Password is controlled by the{" "}
          <code className="rounded bg-amber-100 px-1">ADMIN_PASSWORD</code> environment variable. Go to your Vercel project → Settings → Environment Variables to change it.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
          </div>
          {message && (
            <p
              className={`text-sm ${status === "success" ? "text-emerald-600" : "text-red-600"}`}
            >
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              "Change password"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
