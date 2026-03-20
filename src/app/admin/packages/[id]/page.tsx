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
        <p className="text-stone-600 dark:text-stone-400">Package not found</p>
        <Link
          href="/admin/packages"
          className="mt-4 font-medium text-teal-600 hover:text-teal-700"
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
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/ai?tool=package_writer&packageId=${pkg.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-white"
          >
            <Bot className="h-4 w-4" />
            AI copy
          </Link>
          <PackageActions pkgId={pkg.id} pkgName={pkg.name} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/50 shadow-lg backdrop-blur-xl">
        <div className="border-b border-white/20 bg-amber-500/10 px-6 py-6 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">
            {pkg.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-600 dark:text-stone-400">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {pkg.destination}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {pkg.duration}
            </span>
            <span className="flex items-center gap-2 text-lg font-semibold text-teal-600 dark:text-teal-400">
              <DollarSign className="h-4 w-4" />
              {pkg.price.toLocaleString()} {pkg.currency} / person
            </span>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Description
            </h2>
            <p className="text-stone-700 dark:text-stone-300">
              {pkg.description || "—"}
            </p>
          </section>

          {pkg.itinerary?.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Itinerary
              </h2>
              <div className="space-y-3">
                {pkg.itinerary.map((day) => (
                  <div
                    key={day.day}
                    className="flex gap-4 rounded-xl border border-white/20 bg-white/30 px-4 py-3 backdrop-blur-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                      {day.day}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-stone-900 dark:text-stone-50">
                        {day.title}
                      </h3>
                      <p className="text-sm text-stone-600 dark:text-stone-400">
                        {day.description}
                      </p>
                      {(day.accommodationOptions?.length ?? 0) > 0 ? (
                        <p className="mt-1.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                          Hotel choices: {day.accommodationOptions!.map((o) => o.label).join(", ")}
                        </p>
                      ) : day.accommodation ? (
                        <p className="mt-1 text-xs text-stone-500">
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
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                <Check className="h-4 w-4 text-emerald-500" />
                Inclusions
              </h2>
              <ul className="space-y-1 text-stone-700 dark:text-stone-300">
                {pkg.inclusions?.length ? (
                  pkg.inclusions.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-stone-500">—</li>
                )}
              </ul>
            </section>
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                <X className="h-4 w-4 text-stone-400" />
                Exclusions
              </h2>
              <ul className="space-y-1 text-stone-600 dark:text-stone-400">
                {pkg.exclusions?.length ? (
                  pkg.exclusions.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-stone-500">—</li>
                )}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
