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
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Employees
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Manage staff records and pay rates
          </p>
        </div>
        <Link
          href="/admin/employees/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </Link>
      </div>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/40 bg-white/30 py-16 backdrop-blur-xl">
          <UserCog className="h-12 w-12 text-stone-400" />
          <p className="mt-4 text-stone-600 dark:text-stone-400">
            No employees yet. Add your first one to run payroll.
          </p>
          <Link
            href="/admin/employees/new"
            className="mt-4 font-medium text-teal-600 hover:text-teal-700"
          >
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
