import Link from "next/link";
import { Wallet, Plus, CheckCircle, Clock } from "lucide-react";
import { getPayrollRuns } from "@/lib/db";
import { RunPayrollForm } from "./RunPayrollForm";

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", color: "text-amber-600", icon: Clock },
  approved: { label: "Approved", color: "text-blue-600", icon: Clock },
  paid: { label: "Paid", color: "text-emerald-600", icon: CheckCircle },
};

export default async function PayrollPage() {
  const runs = await getPayrollRuns();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Payroll
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Run payroll and track staff payments
          </p>
        </div>
        <RunPayrollForm />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Payroll Runs</h2>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/40 bg-white/30 py-16 backdrop-blur-xl">
            <Wallet className="h-12 w-12 text-stone-400" />
            <p className="mt-4 text-stone-600 dark:text-stone-400">
              No payroll runs yet. Add employees first, then run payroll.
            </p>
            <Link href="/admin/employees" className="mt-4 font-medium text-teal-600 hover:text-teal-700">
              Go to Employees
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const config = statusConfig[run.status] ?? statusConfig.draft;
              const Icon = config.icon;
              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-xl border border-white/30 bg-white/50 p-4 shadow-sm backdrop-blur-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-lg p-2 ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-stone-900 dark:text-stone-50">
                        {run.periodStart} – {run.periodEnd}
                      </p>
                      <p className="text-sm text-stone-500">
                        Pay date: {run.payDate} · {run.items.length} employees
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-stone-500">Total Net</p>
                      <p className="font-semibold text-stone-900 dark:text-stone-50">
                        {run.totalNet.toLocaleString()} {run.currency}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                    {run.status !== "paid" && (
                      <form action={async () => {
                        "use server";
                        const { markPayrollPaidAction } = await import("@/app/actions/payroll");
                        await markPayrollPaidAction(run.id);
                      }}>
                        <button
                          type="submit"
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                          Mark as Paid
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/admin/payroll/${run.id}`}
                      className="text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
