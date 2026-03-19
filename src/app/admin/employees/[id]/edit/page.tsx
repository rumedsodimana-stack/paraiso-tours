import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getEmployee } from "@/lib/db";
import { EmployeeForm } from "../../EmployeeForm";
import { updateEmployeeAction } from "@/app/actions/employees";
import { SaveSuccessBanner } from "../../../SaveSuccessBanner";

export default async function EditEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = searchParams ? await searchParams : {};
  const employee = await getEmployee(id);
  if (!employee) notFound();

  async function action(formData: FormData) {
    "use server";
    return updateEmployeeAction(id, formData);
  }

  return (
    <div className="space-y-6">
      {saved === "1" && <SaveSuccessBanner message="Saved successfully" />}
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Employees
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Edit {employee.name}</h1>
        <EmployeeForm employee={employee} action={action} />
      </div>
    </div>
  );
}
