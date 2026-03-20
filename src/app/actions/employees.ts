"use server";

import { revalidatePath } from "next/cache";
import { createEmployee, updateEmployee, deleteEmployee, getEmployee } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import type { EmployeePayType } from "@/lib/types";

function parseOptionalNum(val: string | null): number | undefined {
  if (!val?.trim()) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

export async function createEmployeeAction(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || undefined;
  const role = (formData.get("role") as string)?.trim();
  const department = (formData.get("department") as string)?.trim() || undefined;
  const payTypeRaw = (formData.get("payType") as string) || "salary";
  const payType = (payTypeRaw === "commission" || payTypeRaw === "hourly" ? payTypeRaw : "salary") as EmployeePayType;
  const salary = parseOptionalNum(formData.get("salary") as string);
  const commissionPct = parseOptionalNum(formData.get("commissionPct") as string);
  const hourlyRate = parseOptionalNum(formData.get("hourlyRate") as string);
  const taxPct = parseOptionalNum(formData.get("taxPct") as string);
  const benefitsAmount = parseOptionalNum(formData.get("benefitsAmount") as string);
  const currency = (formData.get("currency") as string) || "USD";
  const bankName = (formData.get("bankName") as string)?.trim() || undefined;
  const accountNumber = (formData.get("accountNumber") as string)?.trim() || undefined;
  const statusVal = (formData.get("status") as string) || "active";
  const status: "active" | "inactive" = statusVal === "inactive" ? "inactive" : "active";
  const startDate = (formData.get("startDate") as string)?.trim() || undefined;

  if (!name || !email) return { error: "Name and email are required" };

  const employee = await createEmployee({
    name,
    email,
    phone,
    role: role || "Staff",
    department,
    payType: payType as EmployeePayType,
    salary,
    commissionPct,
    hourlyRate,
    taxPct,
    benefitsAmount,
    currency,
    bankName,
    accountNumber,
    status: status === "inactive" ? "inactive" : "active",
    startDate,
  });

  await recordAuditEvent({
    entityType: "employee",
    entityId: employee.id,
    action: "created",
    summary: `Employee created: ${employee.name}`,
    details: [
      `Role: ${employee.role}`,
      `Pay type: ${employee.payType}`,
      `Status: ${employee.status}`,
    ],
  });

  revalidatePath("/admin/employees");
  revalidatePath("/admin/payroll");
  return { success: true, id: employee.id };
}

export async function updateEmployeeAction(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || undefined;
  const role = (formData.get("role") as string)?.trim();
  const department = (formData.get("department") as string)?.trim() || undefined;
  const payTypeRaw = (formData.get("payType") as string) || "salary";
  const payType = (payTypeRaw === "commission" || payTypeRaw === "hourly" ? payTypeRaw : "salary") as EmployeePayType;
  const salary = parseOptionalNum(formData.get("salary") as string);
  const commissionPct = parseOptionalNum(formData.get("commissionPct") as string);
  const hourlyRate = parseOptionalNum(formData.get("hourlyRate") as string);
  const taxPct = parseOptionalNum(formData.get("taxPct") as string);
  const benefitsAmount = parseOptionalNum(formData.get("benefitsAmount") as string);
  const currency = (formData.get("currency") as string) || "USD";
  const bankName = (formData.get("bankName") as string)?.trim() || undefined;
  const accountNumber = (formData.get("accountNumber") as string)?.trim() || undefined;
  const status = ((formData.get("status") as string) || "active") as "active" | "inactive";
  const startDate = (formData.get("startDate") as string)?.trim() || undefined;

  if (!name || !email) return { error: "Name and email are required" };

  const updated = await updateEmployee(id, {
    name,
    email,
    phone,
    role: role || "Staff",
    department,
    payType,
    salary,
    commissionPct,
    hourlyRate,
    taxPct,
    benefitsAmount,
    currency,
    bankName,
    accountNumber,
    status: status === "inactive" ? "inactive" : "active",
    startDate,
  });

  if (!updated) return { error: "Employee not found" };

  await recordAuditEvent({
    entityType: "employee",
    entityId: updated.id,
    action: "updated",
    summary: `Employee updated: ${updated.name}`,
    details: [
      `Role: ${updated.role}`,
      `Pay type: ${updated.payType}`,
      `Status: ${updated.status}`,
    ],
  });
  revalidatePath("/admin/employees");
  revalidatePath("/admin/payroll");
  return { success: true };
}

export async function deleteEmployeeAction(id: string): Promise<{ success?: boolean; error?: string }> {
  const employee = await getEmployee(id);
  const ok = await deleteEmployee(id);
  if (!ok) return { error: "Employee not found" };
  if (employee) {
    await recordAuditEvent({
      entityType: "employee",
      entityId: employee.id,
      action: "archived",
      summary: `Employee archived: ${employee.name}`,
    });
  }
  revalidatePath("/admin/employees");
  revalidatePath("/admin/payroll");
  return { success: true };
}
