"use client";

import { FileText, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

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
        {[].length === 0 && (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white/50 py-12 text-center text-stone-500">
            No quotations yet. Create one from a booking.
          </p>
        )}
      </div>
    </div>
  );
}
