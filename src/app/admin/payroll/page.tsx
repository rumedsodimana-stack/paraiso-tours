import Link from "next/link";
import { Wallet, CheckCircle, Clock } from "lucide-react";
import { getPayrollRuns } from "@/lib/db";
import { RunPayrollForm } from "./RunPayrollForm";

const statusConfig: Record<string, { label: string; badgeClass: string; icon: typeof CheckCircle }> = {
  draft:    { label: "Draft",    badgeClass: "bg-[#f3e8ce] text-[#7a5a17]", icon: Clock },
  approved: { label: "Approved", badgeClass: "bg-[#d6e2e5] text-[#294b55]", icon: Clock },
  paid:     { label: "Paid",     badgeClass: "bg-[#dce8dc] text-[#375a3f]", icon: CheckCircle },
};

export default async function PayrollPage() {
  const runs = await getPayrollRuns();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Payroll</h1>
          <p className="mt-1 text-sm text-[#5e7279]">Run payroll and track staff payments</p>
        </div>
        <RunPayrollForm />
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#11272b]">Payroll Runs</h2>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16">
            <Wallet className="h-10 w-10 text-[#8a9ba1]" />
            <p className="mt-4 text-[#5e7279]">No payroll runs yet. Add employees first, then run payroll.</p>
            <Link href="/admin/employees" className="mt-4 font-medium text-[#12343b] hover:underline">
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
                  className="paraiso-card flex items-center justify-between rounded-2xl p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef4f4] text-[#12343b]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[#11272b]">
                        {run.periodStart} – {run.periodEnd}
                      </p>
                      <p className="text-sm text-[#8a9ba1]">
                        Pay date: {run.payDate} · {run.items.length} employees
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-[#8a9ba1]">Total Net</p>
                      <p className="font-semibold text-[#11272b]">
                        {run.totalNet.toLocaleString()} {run.currency}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.badgeClass}`}>
                      {config.label}
                    </span>
                    {run.status !== "paid" && (
                      <form action={async () => {
                        "use server";
                        const { markPayrollPaidAction } = await import("@/app/actions/payroll");
                        await markPayrollPaidAction(run.id);
                      }}>
                        <button
                          type="submit"
                          className="rounded-xl bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
                        >
                          Mark as Paid
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/admin/payroll/${run.id}`}
                      className="text-sm font-medium text-[#12343b] hover:underline"
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
