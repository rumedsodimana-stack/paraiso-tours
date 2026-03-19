"use server";

import { revalidatePath } from "next/cache";
import { getEmployees, getTours, createPayrollRun, updatePayrollRun, createPayment } from "@/lib/db";
import type { PayrollItem } from "@/lib/types";

function computePayrollItem(emp: {
  id: string;
  name: string;
  payType: string;
  salary?: number;
  commissionPct?: number;
  hourlyRate?: number;
  taxPct?: number;
  benefitsAmount?: number;
}): PayrollItem {
  let gross = 0;
  let notes = "";
  if (emp.payType === "salary" && emp.salary) {
    gross = emp.salary;
  } else if (emp.payType === "commission") {
    gross = 0;
    notes = "Enter commission manually";
  } else if (emp.payType === "hourly" && emp.hourlyRate) {
    gross = 0;
    notes = "Enter hours worked manually";
  }
  const tax = (emp.taxPct ?? 0) / 100 * gross;
  const benefits = emp.benefitsAmount ?? 0;
  return {
    employeeId: emp.id,
    employeeName: emp.name,
    grossAmount: gross,
    taxAmount: tax,
    benefitsAmount: benefits,
    netAmount: gross - tax - benefits,
    notes: notes || undefined,
  };
}

export async function runPayrollAction(formData: FormData) {
  const periodStart = (formData.get("periodStart") as string)?.trim();
  const periodEnd = (formData.get("periodEnd") as string)?.trim();
  const payDate = (formData.get("payDate") as string)?.trim();

  if (!periodStart || !periodEnd || !payDate) {
    return { error: "Period start, end, and pay date are required" };
  }

  const employees = await getEmployees();
  const activeEmps = employees.filter((e) => e.status === "active");
  const items: PayrollItem[] = activeEmps.map((e) => computePayrollItem(e));

  const totalGross = items.reduce((s, i) => s + i.grossAmount, 0);
  const totalDeductions = items.reduce((s, i) => s + i.taxAmount + i.benefitsAmount, 0);
  const totalNet = items.reduce((s, i) => s + i.netAmount, 0);

  const run = await createPayrollRun({
    periodStart,
    periodEnd,
    payDate,
    status: "draft",
    items,
    totalGross,
    totalDeductions,
    totalNet,
    currency: "USD",
  });

  revalidatePath("/admin/payroll");
  return { success: true, id: run.id };
}

export async function markPayrollPaidAction(id: string) {
  const { getPayrollRun } = await import("@/lib/db");
  const run = await getPayrollRun(id);
  if (!run) return { error: "Payroll run not found" };
  if (run.status === "paid") return { error: "Already paid" };

  await updatePayrollRun(id, {
    status: "paid",
    paidAt: new Date().toISOString().slice(0, 10),
  });

  await createPayment({
    type: "outgoing",
    amount: run.totalNet,
    currency: run.currency,
    description: `Payroll ${run.periodStart}–${run.periodEnd} (${run.items.length} employees)`,
    status: "completed",
    date: run.payDate,
    payrollRunId: id,
  });

  revalidatePath("/admin/payroll");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/payments");
  return { success: true };
}
