"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteActivityAction } from "@/app/actions/planner-activities";

export function DeleteActivityButton({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm("Archive this activity? It will no longer appear in the trip builder."))
      return;
    setPending(true);
    const result = await deleteActivityAction(activityId);
    if (result.error) {
      alert(result.error);
      setPending(false);
      return;
    }
    router.push("/admin/activities?deleted=1");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleDelete}
      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "..." : "Delete"}
    </button>
  );
}
