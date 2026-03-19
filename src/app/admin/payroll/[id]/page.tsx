import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getPayrollRun } from "@/lib/db";
import { MarkPayrollPaidButton } from "./MarkPayrollPaidButton";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
};

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getPayrollRun(id);
  if (!run) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/payroll"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Payroll
      </Link>

      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
              Payroll {run.periodStart} – {run.periodEnd}
            </h1>
            <p className="text-sm text-stone-500">
              Pay date: {run.payDate} · Status: <span className="font-medium">{statusLabel[run.status] ?? run.status}</span>
            </p>
          </div>
          {run.status !== "paid" && <MarkPayrollPaidButton runId={run.id} />}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/30 bg-white/60 p-4">
            <p className="text-xs font-medium text-stone-500">Total Gross</p>
            <p className="text-lg font-bold text-stone-900 dark:text-stone-50">
              {run.totalGross.toLocaleString()} {run.currency}
            </p>
          </div>
          <div className="rounded-xl border border-white/30 bg-white/60 p-4">
            <p className="text-xs font-medium text-stone-500">Deductions</p>
            <p className="text-lg font-bold text-rose-600">
              {run.totalDeductions.toLocaleString()} {run.currency}
            </p>
          </div>
          <div className="rounded-xl border border-white/30 bg-white/60 p-4">
            <p className="text-xs font-medium text-stone-500">Net Pay</p>
            <p className="text-lg font-bold text-emerald-600">
              {run.totalNet.toLocaleString()} {run.currency}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="py-2 text-left font-medium">Employee</th>
                <th className="py-2 text-right font-medium">Gross</th>
                <th className="py-2 text-right font-medium">Tax</th>
                <th className="py-2 text-right font-medium">Benefits</th>
                <th className="py-2 text-right font-medium">Net</th>
                <th className="py-2 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((item) => (
                <tr key={item.employeeId} className="border-b border-stone-100 dark:border-stone-800">
                  <td className="py-2">{item.employeeName}</td>
                  <td className="py-2 text-right">{item.grossAmount.toLocaleString()}</td>
                  <td className="py-2 text-right">{item.taxAmount.toLocaleString()}</td>
                  <td className="py-2 text-right">{item.benefitsAmount.toLocaleString()}</td>
                  <td className="py-2 text-right font-medium">{item.netAmount.toLocaleString()}</td>
                  <td className="py-2 text-stone-500">{item.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
