import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "../EmployeeForm";
import { createEmployeeAction } from "@/app/actions/employees";

export default function NewEmployeePage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Employees
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Add Employee</h1>
        <EmployeeForm action={createEmployeeAction} />
      </div>
    </div>
  );
}
