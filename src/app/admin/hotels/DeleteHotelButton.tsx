"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteHotelAction } from "@/app/actions/hotels";

export function DeleteHotelButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    const confirmed = window.confirm(
      `Archive "${name}"? It will be hidden from new bookings and package design.`
    );
    if (!confirmed) return;

    setError("");
    startTransition(async () => {
      const result = await deleteHotelAction(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/admin/hotels?archived=1");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? "Archiving..." : "Archive"}
      </button>
      {error ? (
        <p className="max-w-sm text-right text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
