import type { Lead, TourPackage, PackageOption, HotelSupplier } from "./types";
import { getBookingBreakdownBySupplier } from "./booking-breakdown";
import { calcOptionCost } from "./package-price";

export interface PayableItem {
  supplierId: string;
  supplierName: string;
  supplierType: "hotel" | "transport" | "meal";
  amount: number;
  currency: string;
  bankName?: string;
  bankBranch?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;
  bankCurrency?: string;
  paymentReference?: string;
  bookings: { clientName: string; tourStartDate: string; packageName: string }[];
}

function getAccommodationOptionsForNight(pkg: TourPackage, nightIndex: number): PackageOption[] {
  const day = pkg.itinerary?.[nightIndex];
  if (day?.accommodationOptions?.length) return day.accommodationOptions;
  return pkg.accommodationOptions ?? [];
}

/** Get supplier cost items for a tour, using default options when lead has no selections. */
function getSupplierCostItems(
  lead: Lead,
  pkg: TourPackage,
  suppliers: HotelSupplier[]
): { supplierId: string; supplierName: string; supplierType: "hotel" | "transport" | "meal"; costAmount: number; currency: string }[] {
  const leadWithPkg = { ...lead, packageId: pkg.id };
  const breakdown = getBookingBreakdownBySupplier(leadWithPkg, pkg, suppliers);
  const pax = lead.pax ?? 1;
  const nightsMatch = pkg.duration.match(/(\d+)\s*[Nn]ight/);
  const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 7;
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  const items: { supplierId: string; supplierName: string; supplierType: "hotel" | "transport" | "meal"; costAmount: number; currency: string }[] = [];

  function addFromOption(opt: PackageOption, type: "hotel" | "transport" | "meal", nightsUsed: number) {
    if (!opt.supplierId || opt.supplierId.startsWith("custom_")) return;
    const costAmount = calcOptionCost(opt, pax, nightsUsed);
    if (costAmount <= 0) return;
    const supplier = supplierMap.get(opt.supplierId);
    items.push({
      supplierId: opt.supplierId,
      supplierName: supplier?.name ?? opt.label,
      supplierType: type,
      costAmount,
      currency: pkg.currency,
    });
  }

  if (breakdown && breakdown.supplierItems.length > 0) {
    for (const item of breakdown.supplierItems) {
      if (item.supplierId.startsWith("custom_")) continue;
      const costAmount = item.costAmount ?? (item.amount || 0);
      if (costAmount <= 0) continue;
      items.push({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        supplierType: item.supplierType,
        costAmount,
        currency: item.currency,
      });
    }
    return items;
  }

  const hasPerNightAccom = pkg.itinerary?.some((d) => d.accommodationOptions?.length);
  if (hasPerNightAccom) {
    for (let i = 0; i < nights; i++) {
      const opts = getAccommodationOptionsForNight(pkg, i);
      const def = opts.find((o) => o.isDefault) ?? opts[0];
      if (def) addFromOption(def, "hotel", 1);
    }
  } else {
    const def = pkg.accommodationOptions?.find((o) => o.isDefault) ?? pkg.accommodationOptions?.[0];
    if (def) addFromOption(def, "hotel", nights);
  }

  const transportDef = pkg.transportOptions?.find((o) => o.isDefault) ?? pkg.transportOptions?.[0];
  if (transportDef) addFromOption(transportDef, "transport", nights);

  const mealDef = pkg.mealOptions?.find((o) => o.isDefault) ?? pkg.mealOptions?.[0];
  if (mealDef) addFromOption(mealDef, "meal", nights);

  return items;
}

/** Get total supplier cost for a single tour (for margin calculation). */
export async function getCostForTour(
  tour: { leadId: string; packageId: string },
  getLead: (id: string) => Promise<Lead | null>,
  getPackage: (id: string) => Promise<TourPackage | null>,
  suppliers: HotelSupplier[]
): Promise<number> {
  const lead = await getLead(tour.leadId);
  const pkg = await getPackage(tour.packageId);
  if (!lead || !pkg) return 0;
  const items = getSupplierCostItems({ ...lead, packageId: pkg.id }, pkg, suppliers);
  return items.reduce((s, i) => s + i.costAmount, 0);
}

export interface GetPayablesInput {
  tours: { id: string; leadId: string; clientName: string; startDate: string; packageId: string; packageName: string }[];
  getLead: (id: string) => Promise<Lead | null>;
  getPackage: (id: string) => Promise<TourPackage | null>;
  suppliers: HotelSupplier[];
  startDate: string;
  endDate: string;
  /** Outgoing payments from payables - exclude supplier+currency where paid for this week */
  paidPayments?: { supplierId: string; currency: string; payableWeekStart: string; payableWeekEnd: string }[];
}

/**
 * Get aggregated payables for tours starting in the date range.
 * Groups by supplier and currency, includes banking details for transfers.
 */
export async function getPayablesForDateRange(input: GetPayablesInput): Promise<PayableItem[]> {
  const { tours, getLead, getPackage, suppliers, startDate, endDate, paidPayments } = input;
  const paidKeys = new Set<string>();
  for (const p of paidPayments ?? []) {
    if (p.payableWeekStart === startDate && p.payableWeekEnd === endDate) {
      paidKeys.add(`${p.supplierId}|${p.currency}`);
    }
  }
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  const inRange = tours.filter((t) => {
    const d = new Date(t.startDate).getTime();
    return d >= start && d <= end;
  });

  const bySupplier = new Map<string, PayableItem>();

  for (const tour of inRange) {
    const lead = await getLead(tour.leadId);
    const pkg = await getPackage(tour.packageId);
    if (!lead || !pkg) continue;
    const leadForBreakdown = { ...lead, packageId: pkg.id };

    const items = getSupplierCostItems(leadForBreakdown, pkg, suppliers);
    const bookingRef = {
      clientName: tour.clientName,
      tourStartDate: tour.startDate,
      packageName: tour.packageName,
    };

    for (const item of items) {
      const key = `${item.supplierId}|${item.currency}`;
      if (paidKeys.has(key)) continue;
      const supplier = suppliers.find((s) => s.id === item.supplierId);
      const existing = bySupplier.get(key);
      if (existing) {
        existing.amount += item.costAmount;
        existing.bookings.push(bookingRef);
      } else {
        bySupplier.set(key, {
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          supplierType: item.supplierType,
          amount: item.costAmount,
          currency: item.currency,
          bankName: supplier?.bankName,
          bankBranch: supplier?.bankBranch,
          accountName: supplier?.accountName,
          accountNumber: supplier?.accountNumber,
          swiftCode: supplier?.swiftCode,
          bankCurrency: supplier?.bankCurrency,
          paymentReference: supplier?.paymentReference,
          bookings: [bookingRef],
        });
      }
    }
  }

  return Array.from(bySupplier.values()).sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName)
  );
}

/** Get start/end of week (Mon–Sun) containing date. */
export function getWeekBounds(date: Date): { startDate: string; endDate: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const start = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const end = d.toISOString().slice(0, 10);
  return { startDate: start, endDate: end };
}
