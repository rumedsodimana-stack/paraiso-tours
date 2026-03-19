"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Clock, DollarSign, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { TourPackage } from "@/lib/types";
import { deletePackageAction } from "@/app/actions/packages";

export function PackagesGrid({ initialPackages }: { initialPackages: TourPackage[] }) {
  const [search, setSearch] = useState("");
  const [packages, setPackages] = useState(initialPackages);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filteredPackages = packages.filter(
    (pkg) =>
      pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.destination.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Archive this package? It will be hidden from new bookings.")) return;
    setDeleting(id);
    const result = await deletePackageAction(id);
    if (result?.success) {
      setPackages((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleting(null);
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Tour Packages
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Build and customize packages for client quotations
          </p>
        </div>
        <Link
          href="/admin/packages/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          Create Package
        </Link>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Search packages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/20 bg-white/40 py-2.5 pl-4 pr-4 text-stone-900 placeholder-stone-500 backdrop-blur-md focus:border-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
        />
      </div>

      {filteredPackages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/30 bg-white/30 py-16 backdrop-blur-xl">
          <p className="text-stone-600">No packages found.</p>
          <Link href="/admin/packages/new" className="mt-4 font-medium text-teal-600 hover:text-teal-700">
            Create your first package
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPackages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onDelete={handleDelete} deleting={deleting} />
          ))}
        </div>
      )}
    </>
  );
}

function PackageCard({
  pkg,
  onDelete,
  deleting,
}: {
  pkg: TourPackage;
  onDelete: (id: string, e: React.MouseEvent) => void;
  deleting: string | null;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/30 bg-white/50 shadow-lg shadow-stone-900/5 backdrop-blur-xl transition hover:border-teal-300/50 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:hover:border-teal-500/30">
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <Link
          href={`/admin/packages/${pkg.id}/edit`}
          className="rounded-lg bg-white/90 p-2 shadow backdrop-blur-sm hover:bg-white"
        >
          <Pencil className="h-4 w-4 text-stone-600" />
        </Link>
        <button
          type="button"
          onClick={(e) => onDelete(pkg.id, e)}
          disabled={deleting === pkg.id}
          className="rounded-lg bg-white/90 p-2 shadow backdrop-blur-sm hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </button>
      </div>
      <Link href={`/admin/packages/${pkg.id}`} className="flex flex-1 flex-col">
        <div className="border-b border-white/20 bg-amber-500/10 px-6 py-4 backdrop-blur-sm">
          <h3 className="font-semibold text-stone-900 group-hover:text-teal-700 dark:text-stone-50 dark:group-hover:text-teal-400">
            {pkg.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600 dark:text-stone-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {pkg.destination}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {pkg.duration}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-6">
          <p className="line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
            {pkg.description}
          </p>
          <div className="mt-4 flex items-end justify-between">
            <span className="flex items-center gap-1 text-lg font-semibold text-teal-600 dark:text-teal-400">
              <DollarSign className="h-4 w-4" />
              {pkg.price.toLocaleString()} {pkg.currency}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-teal-600 opacity-0 transition group-hover:opacity-100 dark:text-teal-400">
              View details
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
