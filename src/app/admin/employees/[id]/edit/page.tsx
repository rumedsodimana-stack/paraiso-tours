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
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Employees
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-xl font-semibold text-[#11272b]">Edit {employee.name}</h1>
        <EmployeeForm employee={employee} action={action} />
      </div>
    </div>
  );
}
