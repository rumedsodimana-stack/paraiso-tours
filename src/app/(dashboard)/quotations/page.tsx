"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";

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
          href="/quotations/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/30 bg-white/20 py-16 backdrop-blur-sm dark:border-white/10 dark:bg-stone-800/20">
        <FileText className="h-12 w-12 text-stone-400" />
        <p className="mt-4 text-stone-600 dark:text-stone-400">
          No quotations yet. Create one from a lead or package.
        </p>
      </div>
    </div>
  );
}
