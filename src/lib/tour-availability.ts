import { getBookingBreakdownBySupplier } from "./booking-breakdown";
import type { HotelSupplier, Lead, Tour, TourPackage } from "./types";

const ACTIVE_TOUR_STATUSES = new Set<Tour["status"]>([
  "scheduled",
  "confirmed",
  "in-progress",
]);

function datesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA <= endB && startB <= endA;
}

function collectSupplierUsage(
  lead: Lead,
  pkg: TourPackage,
  suppliers: HotelSupplier[]
): {
  supplierIds: Set<string>;
  warnings: string[];
} {
  const breakdown = getBookingBreakdownBySupplier(lead, pkg, suppliers);
  const warnings = new Set<string>();
  const supplierIds = new Set<string>();
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  if (!breakdown) {
    warnings.add(
      "Supplier availability could not be verified because the booking selections no longer match the selected package."
    );
    return { supplierIds, warnings: [...warnings] };
  }

  for (const item of breakdown.supplierItems) {
    if (item.supplierId.startsWith("custom_")) {
      warnings.add(
        `Availability cannot be checked for "${item.optionLabel}" because it is not linked to a supplier record.`
      );
      continue;
    }

    if (!supplierMap.has(item.supplierId)) {
      warnings.add(
        `Availability cannot be checked because supplier "${item.supplierName}" is missing from the supplier list.`
      );
      continue;
    }

    supplierIds.add(item.supplierId);
  }

  return { supplierIds, warnings: [...warnings] };
}

export function assessTourAvailability(input: {
  lead: Lead;
  pkg: TourPackage;
  suppliers: HotelSupplier[];
  tours: Tour[];
  startDate: string;
  endDate: string;
  currentTourId?: string;
  getTourContext: (tour: Tour) => { lead: Lead; pkg: TourPackage } | null;
}): {
  status: Tour["availabilityStatus"];
  warnings: string[];
} {
  const supplierMap = new Map(
    input.suppliers.map((supplier) => [supplier.id, supplier])
  );
  const currentUsage = collectSupplierUsage(
    input.lead,
    input.pkg,
    input.suppliers
  );
  const warnings = new Set(currentUsage.warnings);

  const overlappingTours = input.tours.filter(
    (tour) =>
      tour.id !== input.currentTourId &&
      ACTIVE_TOUR_STATUSES.has(tour.status) &&
      datesOverlap(input.startDate, input.endDate, tour.startDate, tour.endDate)
  );

  const overlappingUsage = new Map<string, { refs: string[]; count: number }>();

  for (const tour of overlappingTours) {
    const context = input.getTourContext(tour);
    if (!context) continue;

    const usage = collectSupplierUsage(context.lead, context.pkg, input.suppliers);
    for (const supplierId of usage.supplierIds) {
      const meta = overlappingUsage.get(supplierId) ?? { refs: [], count: 0 };
      meta.count += 1;
      meta.refs.push(`${tour.clientName} (${tour.startDate})`);
      overlappingUsage.set(supplierId, meta);
    }
  }

  for (const supplierId of currentUsage.supplierIds) {
    const supplier = supplierMap.get(supplierId);
    const cap = supplier?.maxConcurrentBookings;
    if (!supplier || cap == null || cap < 1) continue;

    const overlap = overlappingUsage.get(supplierId);
    const totalUsage = 1 + (overlap?.count ?? 0);
    if (totalUsage <= cap) continue;

    const overlappingRefs = overlap?.refs.slice(0, 3).join(", ");
    const moreCount =
      overlap && overlap.refs.length > 3 ? ` and ${overlap.refs.length - 3} more` : "";

    warnings.add(
      `${supplier.name} allows ${cap} concurrent booking${cap === 1 ? "" : "s"}, but this schedule would use ${totalUsage} at the same time${overlappingRefs ? ` with ${overlappingRefs}${moreCount}` : ""}.`
    );
  }

  return {
    status: warnings.size > 0 ? "attention_needed" : "ready",
    warnings: [...warnings],
  };
}
