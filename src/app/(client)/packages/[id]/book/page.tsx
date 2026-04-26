import Link from "next/link";
import { ArrowLeft, CalendarRange, MapPin, Star } from "lucide-react";
import { getPackage, getHotels, getAllMealPlans } from "@/lib/db";
import type { HotelMealPlan, TourPackage } from "@/lib/types";
import { resolvePackageTransportFromCatalog } from "@/lib/package-transport";
import { ClientBookingForm } from "./ClientBookingForm";
import { getClientPackageVisual } from "../../../client-visuals";

export default async function ClientBookPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pkgRaw, hotels, allMealPlans] = await Promise.all([
    getPackage(id),
    getHotels(),
    getAllMealPlans(),
  ]);

  // Refresh transport options from the live vehicle catalog
  // (`/admin/transportation`) so guests always see current prices,
  // capacities, and additions — instead of the frozen snapshot stored
  // on the package row at curation time. See resolvePackageTransportFromCatalog
  // for resolution rules.
  const pkg: TourPackage | null = pkgRaw
    ? {
        ...pkgRaw,
        transportOptions: resolvePackageTransportFromCatalog(pkgRaw, hotels),
      }
    : null;

  // Group hotel meal plans by hotel id so the form can render the right
  // plan list the instant a guest picks a room. We only keep active plans
  // and preserve the order admins set in the meal-plan manager.
  const mealPlansByHotelId: Record<string, HotelMealPlan[]> = {};
  for (const mp of allMealPlans) {
    if (!mp.active) continue;
    (mealPlansByHotelId[mp.hotelId] ??= []).push(mp);
  }

  if (!pkg) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Package not found</p>
        <Link
          href="/packages"
          className="font-medium text-[var(--portal-ink)] hover:opacity-80"
        >
          ← Back to packages
        </Link>
      </div>
    );
  }

  const visual = getClientPackageVisual(pkg);

  // Compact context strip above the viewport-fit wizard shell. The
  // marketing-style split hero was collapsing the shell's 100svh
  // target — the booking flow now owns the viewport and this strip
  // hands off essential package context in a single row.
  return (
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-12">
      <div className="border-b border-[var(--portal-border)]/60 bg-[var(--portal-paper)]/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/packages/${id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:text-[var(--portal-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--portal-eyebrow)]">
              {visual.eyebrow}
            </p>
            <h1 className="portal-display truncate text-base font-semibold tracking-tight text-[var(--portal-ink)] sm:text-lg">
              {pkg.name}
            </h1>
          </div>
          <div className="hidden flex-wrap items-center gap-2 text-xs text-stone-600 sm:flex">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--portal-border)] bg-white/70 px-2.5 py-1">
              <MapPin className="h-3 w-3 text-[var(--portal-gold-deep)]" />
              {pkg.region ?? pkg.destination}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--portal-border)] bg-white/70 px-2.5 py-1">
              <CalendarRange className="h-3 w-3 text-[var(--portal-gold-deep)]" />
              {pkg.duration}
            </span>
            {(pkg.rating ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--portal-border)] bg-white/70 px-2.5 py-1 text-[var(--portal-gold-deep)]">
                <Star className="h-3 w-3 fill-current" />
                {pkg.rating?.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <ClientBookingForm
        pkg={pkg}
        hotels={hotels}
        mealPlansByHotelId={mealPlansByHotelId}
      />
    </div>
  );
}
