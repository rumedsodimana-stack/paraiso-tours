import { getPayments } from "@/lib/db";
import { TrendingDown, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { MarkReceivedButton } from "./MarkReceivedButton";

export const dynamic = "force-dynamic";

export default async function ReceivablePage() {
  const allPayments = await getPayments();

  const pending = allPayments
    .filter((p) => p.type === "incoming" && p.status === "pending")
    .sort((a, b) => b.date.localeCompare(a.date));

  const pendingByCurrency: Record<string, number> = {};
  for (const p of pending) {
    pendingByCurrency[p.currency] = (pendingByCurrency[p.currency] ?? 0) + p.amount;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#11272b]">Receivable</h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Outstanding guest payments due. Mark as received when collected.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="paraiso-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#f3e8ce] p-3 text-[#c9922f]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Pending</p>
              <p className="mt-0.5 text-xl font-bold text-[#11272b]">{pending.length}</p>
            </div>
          </div>
        </div>
        {Object.entries(pendingByCurrency).map(([currency, total]) => (
          <div key={currency} className="paraiso-card rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#f3e8ce] p-3 text-[#c9922f]">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Due ({currency})</p>
                <p className="mt-0.5 text-xl font-bold text-[#11272b]">{total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending receivables */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-[#11272b]">Outstanding ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[#375a3f]" />
            <p className="text-sm font-medium text-[#375a3f]">All caught up</p>
            <p className="mt-1 text-xs text-[#8a9ba1]">No outstanding guest payments</p>
          </div>
        ) : (
          pending.map((p) => (
            <div
              key={p.id}
              className="paraiso-card flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3e8ce]">
                  <AlertCircle className="h-5 w-5 text-[#c9922f]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#11272b] truncate">
                    {p.clientName ?? p.description}
                  </p>
                  <p className="mt-0.5 text-xs text-[#8a9ba1] truncate">{p.description}</p>
                  {p.reference && (
                    <p className="mt-0.5 font-mono text-[10px] font-semibold text-[#5e7279]">{p.reference}</p>
                  )}
                  <p className="mt-0.5 text-xs text-[#8a9ba1]">{p.date}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-[#c9922f]">
                    {p.amount.toLocaleString()} {p.currency}
                  </p>
                  <span className="rounded-full bg-[#f3e8ce] px-2 py-0.5 text-[10px] font-semibold text-[#7a5a17]">
                    Pending
                  </span>
                </div>
                <MarkReceivedButton paymentId={p.id} />
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
