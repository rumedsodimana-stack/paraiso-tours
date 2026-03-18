"use client";

import { Banknote, TrendingUp, TrendingDown } from "lucide-react";

export default function PaymentsPage() {
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
              <p className="text-xl font-bold text-stone-900 dark:text-stone-50">$24,500</p>
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
              <p className="text-xl font-bold text-stone-900 dark:text-stone-50">$18,200</p>
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
              <p className="text-xl font-bold text-stone-900 dark:text-stone-50">$6,300</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/20 bg-white/40 p-8 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
        <p className="text-center text-stone-500 dark:text-stone-400">
          Payment transactions will appear here.
        </p>
      </div>
    </div>
  );
}
