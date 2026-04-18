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
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Payroll
      </Link>

      <div className="paraiso-card rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#11272b]">
              Payroll {run.periodStart} – {run.periodEnd}
            </h1>
            <p className="text-sm text-[#5e7279]">
              Pay date: {run.payDate} · Status: <span className="font-medium">{statusLabel[run.status] ?? run.status}</span>
            </p>
          </div>
          {run.status !== "paid" && <MarkPayrollPaidButton runId={run.id} />}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
            <p className="text-xs font-medium text-[#5e7279]">Total Gross</p>
            <p className="text-lg font-bold text-[#11272b]">
              {run.totalGross.toLocaleString()} {run.currency}
            </p>
          </div>
          <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
            <p className="text-xs font-medium text-[#5e7279]">Deductions</p>
            <p className="text-lg font-bold text-rose-600">
              {run.totalDeductions.toLocaleString()} {run.currency}
            </p>
          </div>
          <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
            <p className="text-xs font-medium text-[#5e7279]">Net Pay</p>
            <p className="text-lg font-bold text-emerald-600">
              {run.totalNet.toLocaleString()} {run.currency}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e0e4dd]">
                <th className="py-2 text-left font-medium text-[#11272b]">Employee</th>
                <th className="py-2 text-right font-medium text-[#11272b]">Gross</th>
                <th className="py-2 text-right font-medium text-[#11272b]">Tax</th>
                <th className="py-2 text-right font-medium text-[#11272b]">Benefits</th>
                <th className="py-2 text-right font-medium text-[#11272b]">Net</th>
                <th className="py-2 text-left font-medium text-[#11272b]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((item) => (
                <tr key={item.employeeId} className="border-b border-[#e0e4dd]">
                  <td className="py-2 text-[#11272b]">{item.employeeName}</td>
                  <td className="py-2 text-right">{item.grossAmount.toLocaleString()}</td>
                  <td className="py-2 text-right">{item.taxAmount.toLocaleString()}</td>
                  <td className="py-2 text-right">{item.benefitsAmount.toLocaleString()}</td>
                  <td className="py-2 text-right font-medium">{item.netAmount.toLocaleString()}</td>
                  <td className="py-2 text-[#5e7279]">{item.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
