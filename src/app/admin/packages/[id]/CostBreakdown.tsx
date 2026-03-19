import { Calculator } from "lucide-react";
import type { TourPackage, PackageOption } from "@/lib/types";

function parseNights(duration: string): number {
  const m = duration.match(/(\d+)\s*[Nn]ight/);
  return m ? parseInt(m[1], 10) : 0;
}

function calcOptionPrice(opt: PackageOption, pax: number, nights: number): number {
  switch (opt.priceType) {
    case "per_person":
      return opt.price * pax;
    case "per_night":
      return opt.price * nights;
    case "per_day":
      return opt.price * (nights + 1);
    case "total":
      return opt.price;
    default:
      return opt.price;
  }
}

function calcOptionCost(opt: PackageOption, pax: number, nights: number): number {
  const cost = opt.costPrice ?? opt.price;
  switch (opt.priceType) {
    case "per_person":
      return cost * pax;
    case "per_night":
      return cost * nights;
    case "per_day":
      return cost * (nights + 1);
    case "total":
      return cost;
    default:
      return cost;
  }
}

export function CostBreakdown({ pkg }: { pkg: TourPackage }) {
  const nights = parseNights(pkg.duration) || 7;
  const pax = 2;

  const basePrice = pkg.price * pax;
  let totalSell = basePrice;
  let totalCost = 0;

  const mealDefault = pkg.mealOptions?.find((o) => o.isDefault) ?? pkg.mealOptions?.[0];
  const transportDefault = pkg.transportOptions?.find((o) => o.isDefault) ?? pkg.transportOptions?.[0];
  const hasPerNightAccom = pkg.itinerary?.some((d) => d.accommodationOptions?.length);
  const accomDefault = pkg.accommodationOptions?.find((o) => o.isDefault) ?? pkg.accommodationOptions?.[0];

  const rows: { label: string; sell: number; cost?: number }[] = [
    { label: `Base (${pkg.price.toLocaleString()} × ${pax} pax)`, sell: basePrice },
  ];

  if (mealDefault) {
    const sell = calcOptionPrice(mealDefault, pax, nights);
    const cost = calcOptionCost(mealDefault, pax, nights);
    totalSell += sell;
    if (mealDefault.costPrice != null) totalCost += cost;
    rows.push({
      label: `Meal: ${mealDefault.label}`,
      sell,
      cost: mealDefault.costPrice != null ? cost : undefined,
    });
  }
  if (transportDefault) {
    const sell = calcOptionPrice(transportDefault, pax, nights);
    const cost = calcOptionCost(transportDefault, pax, nights);
    totalSell += sell;
    if (transportDefault.costPrice != null) totalCost += cost;
    rows.push({
      label: `Transport: ${transportDefault.label}`,
      sell,
      cost: transportDefault.costPrice != null ? cost : undefined,
    });
  }
  if (hasPerNightAccom) {
    for (let i = 0; i < nights; i++) {
      const opts = pkg.itinerary?.[i]?.accommodationOptions ?? pkg.accommodationOptions ?? [];
      const def = opts.find((o) => o.isDefault) ?? opts[0];
      if (def) {
        const sell = calcOptionPrice(def, pax, 1);
        const cost = calcOptionCost(def, pax, 1);
        totalSell += sell;
        if (def.costPrice != null) totalCost += cost;
        rows.push({
          label: `Night ${i + 1}: ${def.label}`,
          sell,
          cost: def.costPrice != null ? cost : undefined,
        });
      }
    }
  } else if (accomDefault) {
    const sell = calcOptionPrice(accomDefault, pax, nights);
    const cost = calcOptionCost(accomDefault, pax, nights);
    totalSell += sell;
    if (accomDefault.costPrice != null) totalCost += cost;
    rows.push({
      label: `Stay: ${accomDefault.label}`,
      sell,
      cost: accomDefault.costPrice != null ? cost : undefined,
    });
  }

  for (const opt of pkg.customOptions ?? []) {
    const sell = calcOptionPrice(opt, pax, nights);
    const cost = calcOptionCost(opt, pax, nights);
    totalSell += sell;
    if (opt.costPrice != null) totalCost += cost;
    rows.push({
      label: opt.label,
      sell,
      cost: opt.costPrice != null ? cost : undefined,
    });
  }

  const hasCostData = rows.some((r) => r.cost != null);
  const margin = hasCostData ? totalSell - totalCost : null;
  const marginPct = margin != null && totalSell > 0 ? ((margin / totalSell) * 100).toFixed(1) : null;

  const hasAnyOptions =
    (pkg.mealOptions?.length ?? 0) > 0 ||
    (pkg.transportOptions?.length ?? 0) > 0 ||
    (pkg.accommodationOptions?.length ?? 0) > 0 ||
    hasPerNightAccom ||
    (pkg.customOptions?.length ?? 0) > 0;

  if (!hasAnyOptions) return null;

  return (
    <section className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
        <Calculator className="h-4 w-4 text-amber-600" />
        Cost Breakdown
      </h2>
      <p className="mb-3 text-xs text-stone-500">
        Sample: {pax} pax × {nights} nights (default options)
      </p>
      <div className="space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span className="text-stone-700 dark:text-stone-300">{r.label}</span>
            <span className="tabular-nums">
              {r.sell.toLocaleString()} {pkg.currency}
              {r.cost != null && (
                <span className="ml-2 text-xs text-stone-500">
                  (cost: {r.cost.toLocaleString()})
                </span>
              )}
            </span>
          </div>
        ))}
        <div className="mt-2 border-t border-amber-200/50 pt-2 font-medium dark:border-amber-900/30">
          <div className="flex justify-between">
            <span>Total</span>
            <span>
              {totalSell.toLocaleString()} {pkg.currency}
            </span>
          </div>
          {margin != null && marginPct != null && (
            <div className="mt-1 flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Margin (options w/ cost)</span>
              <span>
                {margin.toLocaleString()} {pkg.currency} ({marginPct}%)
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
