"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteQuotationAction } from "@/app/actions/quotations";

export function DeleteQuotationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this quotation? This cannot be undone.")) return;
        startTransition(async () => {
          const result = await deleteQuotationAction(id);
          if (!result?.error) {
            router.push("/admin/quotations");
          }
        });
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
