import Link from "next/link";
import { ArrowLeft, Bot, MapPin, Clock, DollarSign, Check, X } from "lucide-react";
import { getPackage } from "@/lib/db";
import { PackageActions } from "./PackageActions";
import { CostBreakdown } from "./CostBreakdown";
import { SaveSuccessBanner } from "../../SaveSuccessBanner";

export default async function PackageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const resolved = searchParams ? await searchParams : {};
  const saved = resolved?.saved;
  const pkg = await getPackage(id);

  if (!pkg) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-[#5e7279]">Package not found</p>
        <Link
          href="/admin/packages"
          className="mt-4 font-medium text-[#12343b] hover:text-[#1a474f]"
        >
          Back to packages
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saved === "1" && <SaveSuccessBanner message="Package updated successfully" />}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/packages"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/ai?tool=package_writer&packageId=${pkg.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd]"
          >
            <Bot className="h-4 w-4" />
            AI copy
          </Link>
          <PackageActions pkgId={pkg.id} pkgName={pkg.name} />
        </div>
      </div>

      <div className="paraiso-card overflow-hidden rounded-2xl">
        <div className="border-b border-[#e0e4dd] bg-[#f4ecdd] px-6 py-6">
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-2xl font-bold text-[#11272b]">
              {pkg.name}
            </h1>
            {pkg.reference && (
              <span className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-amber-700 ring-1 ring-amber-200">
                {pkg.reference}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#5e7279]">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {pkg.destination}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {pkg.duration}
            </span>
            <span className="flex items-center gap-2 text-lg font-semibold text-[#12343b]">
              <DollarSign className="h-4 w-4" />
              {pkg.price.toLocaleString()} {pkg.currency} / person
            </span>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#5e7279]">
              Description
            </h2>
            <p className="text-[#11272b]">
              {pkg.description || "—"}
            </p>
          </section>

          {pkg.itinerary?.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#5e7279]">
                Itinerary
              </h2>
              <div className="space-y-3">
                {pkg.itinerary.map((day) => (
                  <div
                    key={day.day}
                    className="flex gap-4 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4f4] text-sm font-bold text-[#12343b]">
                      {day.day}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-[#11272b]">
                        {day.title}
                      </h3>
                      <p className="text-sm text-[#5e7279]">
                        {day.description}
                      </p>
                      {(day.accommodationOptions?.length ?? 0) > 0 ? (
                        <p className="mt-1.5 text-xs font-medium text-[#5e7279]">
                          Hotel choices: {day.accommodationOptions!.map((o) => o.label).join(", ")}
                        </p>
                      ) : day.accommodation ? (
                        <p className="mt-1 text-xs text-[#5e7279]">
                          Hotel: {day.accommodation}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <CostBreakdown pkg={pkg} />

          <div className="grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#5e7279]">
                <Check className="h-4 w-4 text-emerald-500" />
                Inclusions
              </h2>
              <ul className="space-y-1 text-[#11272b]">
                {pkg.inclusions?.length ? (
                  pkg.inclusions.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-[#5e7279]">—</li>
                )}
              </ul>
            </section>
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#5e7279]">
                <X className="h-4 w-4 text-[#8a9ba1]" />
                Exclusions
              </h2>
              <ul className="space-y-1 text-[#5e7279]">
                {pkg.exclusions?.length ? (
                  pkg.exclusions.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#8a9ba1]" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-[#5e7279]">—</li>
                )}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
