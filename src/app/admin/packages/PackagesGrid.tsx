"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Clock, DollarSign, ChevronRight, Pencil, Search, Trash2 } from "lucide-react";
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
          <h1 className="text-2xl font-bold text-[#11272b]">Tour Packages</h1>
          <p className="mt-1 text-sm text-[#5e7279]">Build and customize packages for client quotations</p>
        </div>
        <Link
          href="/admin/packages/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          Create Package
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" />
        <input
          type="text"
          placeholder="Search packages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] py-2.5 pl-10 pr-4 text-[#11272b] placeholder-[#8a9ba1] focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
        />
      </div>

      {filteredPackages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16">
          <p className="text-[#5e7279]">No packages found.</p>
          <Link href="/admin/packages/new" className="mt-4 font-medium text-[#12343b] hover:underline">
            Create your first package
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="paraiso-card group relative flex flex-col overflow-hidden rounded-2xl transition hover:bg-[#f4ecdd]">
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <Link
          href={`/admin/packages/${pkg.id}/edit`}
          className="rounded-lg border border-[#e0e4dd] bg-[#fffbf4] p-1.5 hover:bg-[#f4ecdd]"
        >
          <Pencil className="h-3.5 w-3.5 text-[#5e7279]" />
        </Link>
        <button
          type="button"
          onClick={(e) => onDelete(pkg.id, e)}
          disabled={deleting === pkg.id}
          className="rounded-lg border border-[#e0e4dd] bg-[#fffbf4] p-1.5 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-600" />
        </button>
      </div>
      <Link href={`/admin/packages/${pkg.id}`} className="flex flex-1 flex-col">
        <div className="border-b border-[#e0e4dd] bg-[#f4ecdd] px-5 py-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[#11272b]">{pkg.name}</h3>
            {pkg.reference && (
              <span className="shrink-0 rounded bg-[#f3e8ce] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#7a5a17] ring-1 ring-[#e0d4bc]">
                {pkg.reference}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#5e7279]">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#8a9ba1]" />
              {pkg.destination}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#8a9ba1]" />
              {pkg.duration}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="line-clamp-2 text-sm text-[#5e7279]">{pkg.description}</p>
          <div className="mt-4 flex items-end justify-between">
            <span className="flex items-center gap-1 text-lg font-bold text-[#12343b]">
              <DollarSign className="h-4 w-4" />
              {pkg.price.toLocaleString()} {pkg.currency}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-[#12343b] opacity-0 transition group-hover:opacity-100">
              View details
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
