import { Building2, Car, UtensilsCrossed } from "lucide-react";
import type { Lead, TourPackage, HotelSupplier } from "@/lib/types";
import { getBookingBreakdownBySupplier } from "@/lib/booking-breakdown";

const typeIcons = {
  hotel: Building2,
  transport: Car,
  meal: UtensilsCrossed,
};

export async function BookingSupplierBreakdown({
  lead,
  pkg,
  suppliers,
}: {
  lead: Lead;
  pkg: TourPackage;
  suppliers: HotelSupplier[];
}) {
  const breakdown = getBookingBreakdownBySupplier(lead, pkg, suppliers);
  if (!breakdown) return null;

  const { baseAmount, supplierItems, totalAmount, currency, pax, nights } =
    breakdown;

  return (
    <section className="rounded-xl border border-teal-200/50 bg-teal-50/30 p-4 dark:border-teal-900/30 dark:bg-teal-950/20">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
        Breakdown by supplier
      </h3>
      <p className="mb-3 text-xs text-stone-500">
        {pax} pax × {nights} nights
      </p>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between gap-4 text-stone-700 dark:text-stone-300">
          <span>Base package</span>
          <span className="tabular-nums">
            {baseAmount.toLocaleString()} {currency}
          </span>
        </div>
        {supplierItems.map((item) => {
          const Icon = typeIcons[item.supplierType];
          const typeLabel =
            item.supplierType === "hotel"
              ? "Accommodation"
              : item.supplierType === "transport"
                ? "Transport"
                : "Meals";
          return (
            <div
              key={`${item.supplierId}-${item.optionLabel}`}
              className="flex flex-col gap-0.5 rounded-lg border border-white/50 bg-white/50 px-3 py-2 dark:border-stone-700/50 dark:bg-stone-800/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-teal-600" />
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-200">
                      {item.supplierName}
                    </p>
                    <p className="text-xs text-stone-500">
                      {typeLabel}: {item.optionLabel}
                    </p>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-medium">
                    {item.amount.toLocaleString()} {currency}
                  </p>
                  {item.costAmount != null && (
                    <p className="text-xs text-stone-500">
                      cost: {item.costAmount.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="mt-3 border-t border-teal-200/50 pt-3 dark:border-teal-900/30">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {totalAmount.toLocaleString()} {currency}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
