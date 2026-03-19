"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserCog, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Employee } from "@/lib/types";
import { deleteEmployeeAction } from "@/app/actions/employees";

const payTypeLabels: Record<string, string> = {
  salary: "Salary",
  commission: "Commission",
  hourly: "Hourly",
};

export function EmployeeCard({ emp }: { emp: Employee }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const result = await deleteEmployeeAction(emp.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="group flex items-start justify-between rounded-xl border border-white/30 bg-white/50 p-4 shadow-sm backdrop-blur-sm transition hover:border-teal-200 hover:bg-white/70">
      <Link href={`/admin/employees/${emp.id}/edit`} className="flex flex-1 min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
          <UserCog className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-stone-900 dark:text-stone-50 group-hover:text-teal-700">
            {emp.name}
          </p>
          <p className="text-xs text-stone-500">{emp.role}</p>
          {emp.department && (
            <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">
              {emp.department}
            </p>
          )}
          <p className="mt-1 text-sm font-medium text-teal-600">
            {payTypeLabels[emp.payType] ?? emp.payType}
            {emp.payType === "salary" && emp.salary != null && (
              <>: {emp.salary.toLocaleString()} {emp.currency}/mo</>
            )}
            {emp.payType === "commission" && emp.commissionPct != null && (
              <>: {emp.commissionPct}%</>
            )}
            {emp.payType === "hourly" && emp.hourlyRate != null && (
              <>: {emp.hourlyRate} {emp.currency}/hr</>
            )}
          </p>
          <span
            className={`mt-1 inline-block text-xs ${emp.status === "active" ? "text-emerald-600" : "text-stone-400"}`}
          >
            {emp.status}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 transition group-hover:text-teal-600" />
      </Link>
      <div className="flex shrink-0 items-center gap-1 ml-2">
        <Link
          href={`/admin/employees/${emp.id}/edit`}
          className="rounded-lg p-2 text-stone-500 transition hover:bg-teal-100 hover:text-teal-600"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={`rounded-lg p-2 transition ${
            confirmDelete
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "text-stone-400 hover:bg-red-50 hover:text-red-600"
          }`}
          title={confirmDelete ? "Click again to archive" : "Archive"}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
