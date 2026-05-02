"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteQuotationAction } from "@/app/actions/quotations";

export function DeleteQuotationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this quotation? This cannot be undone.")) return;
          setError(null);
          startTransition(async () => {
            try {
              const result = await deleteQuotationAction(id);
              if (result?.error) {
                // Surface the server's error text so admin sees WHY
                // the delete failed (FK violation, RLS denial, etc.)
                // — without this, the button just resets and the
                // quotation silently stays in the list.
                setError(result.error);
              } else {
                router.push("/admin/quotations");
              }
            } catch (err) {
              // Network drop / server crash mid-action — without this
              // catch the button is stuck on "Deleting…" forever.
              setError(
                err instanceof Error
                  ? err.message
                  : "Couldn't reach the server. Please check your connection and try again."
              );
            }
          });
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
