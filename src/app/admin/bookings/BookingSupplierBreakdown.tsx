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
    <section className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#5e7279]">
        Breakdown by supplier
      </h3>
      <p className="mb-3 text-xs text-[#5e7279]">
        {pax} pax × {nights} nights
      </p>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between gap-4 text-[#11272b]">
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
              className="flex flex-col gap-0.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-[#12343b]" />
                  <div>
                    <p className="font-medium text-[#11272b]">
                      {item.supplierName}
                    </p>
                    <p className="text-xs text-[#5e7279]">
                      {typeLabel}: {item.optionLabel}
                    </p>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-medium">
                    {item.amount.toLocaleString()} {currency}
                  </p>
                  {item.costAmount != null && (
                    <p className="text-xs text-[#5e7279]">
                      cost: {item.costAmount.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="mt-3 border-t border-[#e0e4dd] pt-3">
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
