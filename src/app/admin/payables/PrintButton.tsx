"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50 dark:bg-stone-900 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950 print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print / Save as PDF
    </button>
  );
}
