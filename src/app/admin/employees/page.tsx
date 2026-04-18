import Link from "next/link";
import { UserCog, Plus } from "lucide-react";
import { getEmployees } from "@/lib/db";
import { EmployeeCard } from "./EmployeeCard";

export default async function EmployeesPage() {
  const employees = await getEmployees();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Employees</h1>
          <p className="mt-1 text-sm text-[#5e7279]">Manage staff records and pay rates</p>
        </div>
        <Link
          href="/admin/employees/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </Link>
      </div>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16">
          <UserCog className="h-10 w-10 text-[#8a9ba1]" />
          <p className="mt-4 text-[#5e7279]">No employees yet. Add your first one to run payroll.</p>
          <Link href="/admin/employees/new" className="mt-4 font-medium text-[#12343b] hover:underline">
            Add Employee
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((emp) => (
            <EmployeeCard key={emp.id} emp={emp} />
          ))}
        </div>
      )}
    </div>
  );
}
