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
    <div className="paraiso-card group flex items-start justify-between rounded-2xl p-4 transition hover:bg-[#f4ecdd]">
      <Link href={`/admin/employees/${emp.id}/edit`} className="flex flex-1 min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef4f4] text-[#12343b]">
          <UserCog className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[#11272b]">{emp.name}</p>
          <p className="text-xs text-[#8a9ba1]">{emp.role}</p>
          {emp.department && (
            <p className="mt-0.5 text-sm text-[#5e7279]">{emp.department}</p>
          )}
          <p className="mt-1 text-sm font-semibold text-[#12343b]">
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
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            emp.status === "active"
              ? "bg-[#dce8dc] text-[#375a3f]"
              : "bg-[#e2e3dd] text-[#545a54]"
          }`}>
            {emp.status}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#8a9ba1] transition group-hover:text-[#12343b]" />
      </Link>
      <div className="flex shrink-0 items-center gap-1 ml-2">
        <Link
          href={`/admin/employees/${emp.id}/edit`}
          className="rounded-lg p-2 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
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
              ? "bg-[#eed9cf] text-[#7c3a24] hover:bg-red-100"
              : "text-[#8a9ba1] hover:bg-red-50 hover:text-red-600"
          }`}
          title={confirmDelete ? "Click again to archive" : "Archive"}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
