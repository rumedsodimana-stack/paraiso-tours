import Link from "next/link";
import { Banknote, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getPayments } from "@/lib/db";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ completed?: string; paid?: string }> | { completed?: string; paid?: string };
}) {
  const allPayments = await getPayments();
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const completed = params?.completed === "1";
  const paid = params?.paid === "1";

  // Payment History = completed transactions only
  const payments = allPayments
    .filter((p) => p.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));

  const incoming = payments.filter((p) => p.type === "incoming").reduce((s, p) => s + p.amount, 0);
  const outgoing = payments.filter((p) => p.type === "outgoing").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {(completed || paid) && (
        <SaveSuccessBanner
          message={completed
            ? "Tour marked as completed and paid. Receipt sent to client."
            : "Payable marked as paid. View the transaction below."}
        />
      )}
      <div>
        <h1 className="text-2xl font-bold text-[#11272b]">Payment History</h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Completed incoming and outgoing transactions. Pending collections are in{" "}
          <Link href="/admin/receivable" className="text-[#12343b] underline hover:no-underline font-medium">
            Receivable
          </Link>
          {" "}and pending supplier payments in{" "}
          <Link href="/admin/payables" className="text-[#12343b] underline hover:no-underline font-medium">
            Payables
          </Link>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="paraiso-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#dce8dc] p-3 text-[#375a3f]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Received</p>
              <p className="mt-0.5 text-xl font-bold text-[#11272b]">${incoming.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="paraiso-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#eed9cf] p-3 text-[#7c3a24]">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Paid Out</p>
              <p className="mt-0.5 text-xl font-bold text-[#11272b]">${outgoing.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="paraiso-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#eef4f4] p-3 text-[#12343b]">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Net</p>
              <p className="mt-0.5 text-xl font-bold text-[#11272b]">${(incoming - outgoing).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold text-[#11272b]">Transactions ({payments.length})</h3>
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] p-8 text-center">
            <p className="text-sm text-[#8a9ba1]">No completed transactions yet.</p>
          </div>
        ) : (
          payments.map((p) => (
            <Link
              key={p.id}
              id={p.id}
              href={`/admin/payments/${p.id}`}
              className="paraiso-card flex items-center justify-between rounded-2xl px-4 py-3 transition hover:bg-[#f4ecdd]"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${
                  p.type === "incoming"
                    ? "bg-[#dce8dc] text-[#375a3f]"
                    : "bg-[#eed9cf] text-[#7c3a24]"
                }`}>
                  {p.type === "incoming"
                    ? <ArrowDownRight className="h-4 w-4" />
                    : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-medium text-[#11272b]">{p.description}</p>
                  <p className="text-xs text-[#8a9ba1]">{p.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${
                  p.type === "incoming" ? "text-[#375a3f]" : "text-[#7c3a24]"
                }`}>
                  {p.type === "incoming" ? "+" : "-"}
                  {p.amount.toLocaleString()} {p.currency}
                </p>
                <span className="text-xs text-[#8a9ba1]">
                  {p.type === "incoming" ? "Received" : "Paid"}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
