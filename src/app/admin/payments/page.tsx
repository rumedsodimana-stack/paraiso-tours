"use client";

import { Banknote, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { mockPayments } from "@/lib/mock-data";

export default function PaymentsPage() {
  const incoming = mockPayments.filter((p) => p.type === "incoming" && p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const outgoing = mockPayments.filter((p) => p.type === "outgoing" && p.status === "completed").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Payments
        </h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          Track customer payments and supplier payouts
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Incoming</p>
              <p className="text-xl font-bold text-stone-900 dark:text-stone-50">${incoming.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-100 p-3 text-rose-600 dark:bg-rose-900/30">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Outgoing</p>
              <p className="text-xl font-bold text-stone-900 dark:text-stone-50">${outgoing.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-100 p-3 text-teal-600 dark:bg-teal-900/30">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Net</p>
              <p className="text-xl font-bold text-stone-900 dark:text-stone-50">${(incoming - outgoing).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Recent Transactions</h3>
        {mockPayments.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-2xl border border-white/30 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${p.type === "incoming" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                {p.type === "incoming" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </div>
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-50">{p.description}</p>
                <p className="text-xs text-stone-500">{p.date}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${p.type === "incoming" ? "text-emerald-600" : "text-rose-600"}`}>
                {p.type === "incoming" ? "+" : "-"}{p.amount.toLocaleString()} {p.currency}
              </p>
              <span className={`text-xs ${p.status === "completed" ? "text-stone-500" : "text-amber-600"}`}>{p.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
