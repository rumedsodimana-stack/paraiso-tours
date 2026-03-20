"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-xs font-medium text-rose-600">{error}</span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const response = await fetch("/api/admin/logout", {
                method: "POST",
              });
              if (!response.ok) {
                const data = (await response.json().catch(() => null)) as
                  | { error?: string }
                  | null;
                setError(data?.error ?? "Logout failed");
                return;
              }
              router.replace("/admin/login");
              router.refresh();
            } catch {
              setError("Logout failed");
            }
          });
        }}
        className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/60 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-900"
        disabled={isPending}
      >
        <LogOut className="h-4 w-4" />
        {isPending ? "Signing out…" : "Logout"}
      </button>
    </div>
  );
}
