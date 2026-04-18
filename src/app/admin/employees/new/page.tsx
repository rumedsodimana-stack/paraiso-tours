import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "../EmployeeForm";
import { createEmployeeAction } from "@/app/actions/employees";

export default function NewEmployeePage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Employees
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-xl font-semibold text-[#11272b]">Add Employee</h1>
        <EmployeeForm action={createEmployeeAction} />
      </div>
    </div>
  );
}
