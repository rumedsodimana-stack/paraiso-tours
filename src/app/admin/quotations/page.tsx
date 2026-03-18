"use client";

import { FileText, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { mockQuotations } from "@/lib/mock-data";

const statusColors: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  sent: "bg-sky-100 text-sky-800",
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
};

export default function QuotationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Quotations
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Create and manage tour quotations for clients
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Link>
      </div>

      <div className="space-y-3">
        {mockQuotations.map((q) => (
          <div
            key={q.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/30 bg-white/50 p-4 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-50">{q.clientName}</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">{q.packageName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-teal-600">
                {q.amount.toLocaleString()} {q.currency}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[q.status] ?? "bg-stone-100"}`}>
                {q.status}
              </span>
              <Link href={`/admin/bookings?q=${encodeURIComponent(q.clientName)}`} className="text-teal-600 hover:text-teal-700">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
