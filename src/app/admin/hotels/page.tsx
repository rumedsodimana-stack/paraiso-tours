"use client";

import { MapPin, Plus } from "lucide-react";
import Link from "next/link";

export default function HotelsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Hotels & Suppliers
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Manage hotel contracts and supplier agreements
          </p>
        </div>
        <Link
          href="/hotels/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Add Supplier
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/40 bg-white/30 backdrop-blur-xl py-16">
        <MapPin className="h-12 w-12 text-stone-400" />
        <p className="mt-4 text-stone-600 dark:text-stone-400">
          Upload hotel contracts and manage supplier data.
        </p>
      </div>
    </div>
  );
}
