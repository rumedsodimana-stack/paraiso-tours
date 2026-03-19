"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deletePackageAction } from "@/app/actions/packages";

export function PackageActions({
  pkgId,
  pkgName,
}: {
  pkgId: string;
  pkgName: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Archive package "${pkgName}"? It will be hidden from new bookings.`)) return;
    const result = await deletePackageAction(pkgId);
    if (result?.success) {
      router.push("/admin/packages");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/packages/${pkgId}/edit`}
        className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/50 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-white/70"
      >
        <Pencil className="h-4 w-4" />
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
      >
        <Trash2 className="h-4 w-4" />
        Archive
      </button>
    </div>
  );
}
