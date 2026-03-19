import type { Lead, TourPackage, PackageOption, HotelSupplier } from "./types";
import { calcOptionCost, calcOptionPrice } from "./package-price";

function parseNights(duration: string): number {
  const m = duration.match(/(\d+)\s*[Nn]ight/);
  return m ? parseInt(m[1], 10) : 0;
}

export interface SupplierBreakdownItem {
  supplierId: string;
  supplierName: string;
  supplierType: "hotel" | "transport" | "meal";
  optionLabel: string;
  amount: number;
  costAmount?: number;
  currency: string;
}

export interface BookingBreakdownResult {
  baseAmount: number;
  supplierItems: SupplierBreakdownItem[];
  totalAmount: number;
  currency: string;
  pax: number;
  nights: number;
}

/**
 * Get a booking cost breakdown grouped by supplier (accommodation, transport, meal).
 */
export function getBookingBreakdownBySupplier(
  lead: Lead,
  pkg: TourPackage,
  suppliers: HotelSupplier[]
): BookingBreakdownResult | null {
  if (!lead.packageId || lead.packageId !== pkg.id) return null;

  const pax = lead.pax ?? 1;
  const nights = parseNights(pkg.duration) || 7;
  const currency = pkg.currency;

  const baseAmount = pkg.price * pax;
  const supplierItems: SupplierBreakdownItem[] = [];
  let totalAmount = baseAmount;

  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  const addSupplierItem = (
    option: PackageOption,
    type: "hotel" | "transport" | "meal"
  ) => {
    const amount = calcOptionPrice(option, pax, nights);
    const costAmount = option.costPrice != null ? calcOptionCost(option, pax, nights) : undefined;
    const supplier = option.supplierId ? supplierMap.get(option.supplierId) : null;

    supplierItems.push({
      supplierId: option.supplierId ?? `custom_${option.id}`,
      supplierName: supplier?.name ?? option.label,
      supplierType: type,
      optionLabel: option.label,
      amount,
      costAmount,
      currency,
    });
    totalAmount += amount;
  };

  const addAccommodationItem = (opt: PackageOption, nightsUsed: number) => {
    const amount = calcOptionPrice(opt, pax, nightsUsed);
    const costAmount = opt.costPrice != null ? calcOptionCost(opt, pax, nightsUsed) : undefined;
    const supplier = opt.supplierId ? supplierMap.get(opt.supplierId) : null;
    supplierItems.push({
      supplierId: opt.supplierId ?? `custom_${opt.id}`,
      supplierName: supplier?.name ?? opt.label,
      supplierType: "hotel",
      optionLabel: opt.label,
      amount,
      costAmount,
      currency,
    });
    totalAmount += amount;
  };

  if (lead.selectedAccommodationByNight && Object.keys(lead.selectedAccommodationByNight).length > 0) {
    const byNight = lead.selectedAccommodationByNight;
    for (let i = 0; i < nights; i++) {
      const optId = byNight[String(i)] ?? byNight[i];
      if (!optId) continue;
      const opts = pkg.itinerary?.[i]?.accommodationOptions ?? pkg.accommodationOptions ?? [];
      const opt = opts.find((o) => o.id === optId);
      if (opt) addAccommodationItem(opt, 1);
    }
  } else if (lead.selectedAccommodationOptionId) {
    const opt = pkg.accommodationOptions?.find(
      (o) => o.id === lead.selectedAccommodationOptionId
    );
    if (opt) addSupplierItem(opt, "hotel");
  }

  if (lead.selectedTransportOptionId) {
    const opt = pkg.transportOptions?.find(
      (o) => o.id === lead.selectedTransportOptionId
    );
    if (opt) addSupplierItem(opt, "transport");
  }

  if (lead.selectedMealOptionId) {
    const opt = pkg.mealOptions?.find((o) => o.id === lead.selectedMealOptionId);
    if (opt) addSupplierItem(opt, "meal");
  }

  return {
    baseAmount,
    supplierItems,
    totalAmount,
    currency,
    pax,
    nights,
  };
}

function getSupplierEmail(s: HotelSupplier | undefined): string | null {
  if (!s) return null;
  if (s.email?.trim()) return s.email.trim();
  const m = s.contact?.match(/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : null;
}

export interface SupplierEmailResult {
  emails: string[];
  missing: { supplierName: string; supplierType: string }[];
}

/**
 * Get unique supplier emails for a booking (hotels, transport, meals).
 * Uses supplier.email if set, otherwise parses supplier.contact for email.
 */
export function getBookingSupplierEmails(
  lead: Lead,
  pkg: TourPackage,
  suppliers: HotelSupplier[]
): SupplierEmailResult | null {
  const breakdown = getBookingBreakdownBySupplier(lead, pkg, suppliers);
  if (!breakdown) return null;
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const emails: string[] = [];
  const missing: { supplierName: string; supplierType: string }[] = [];
  const typeLabel = (t: string) =>
    t === "hotel" ? "Accommodation" : t === "transport" ? "Transport" : "Meals";
  for (const item of breakdown.supplierItems) {
    if (item.supplierId.startsWith("custom_")) continue;
    const supplier = supplierMap.get(item.supplierId);
    const email = getSupplierEmail(supplier);
    if (email && !seen.has(email.toLowerCase())) {
      seen.add(email.toLowerCase());
      emails.push(email);
    } else if (!email) {
      missing.push({
        supplierName: item.supplierName,
        supplierType: typeLabel(item.supplierType),
      });
    }
  }
  return { emails, missing };
}

export interface SupplierForSchedule {
  withEmail: {
    email: string;
    supplierName: string;
    supplierType: string;
    optionLabel: string;
  }[];
  missing: { supplierName: string; supplierType: string }[];
}

/**
 * Get suppliers split by email availability for schedule flow.
 * Used to send reservation emails and create todos for missing contacts.
 */
export function getSuppliersForSchedule(
  lead: Lead,
  pkg: TourPackage,
  suppliers: HotelSupplier[]
): SupplierForSchedule | null {
  const breakdown = getBookingBreakdownBySupplier(lead, pkg, suppliers);
  if (!breakdown) return null;
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const typeLabel = (t: string) =>
    t === "hotel" ? "Accommodation" : t === "transport" ? "Transport" : "Meals";
  const withEmail: {
    email: string;
    supplierName: string;
    supplierType: string;
    optionLabel: string;
  }[] = [];
  const missing: { supplierName: string; supplierType: string }[] = [];
  const seenEmails = new Set<string>();
  for (const item of breakdown.supplierItems) {
    if (item.supplierId.startsWith("custom_")) continue;
    const supplier = supplierMap.get(item.supplierId);
    const email = getSupplierEmail(supplier);
    const label = typeLabel(item.supplierType);
    if (email && !seenEmails.has(email.toLowerCase())) {
      seenEmails.add(email.toLowerCase());
      withEmail.push({
        email,
        supplierName: item.supplierName,
        supplierType: label,
        optionLabel: item.optionLabel,
      });
    } else if (!email) {
      missing.push({ supplierName: item.supplierName, supplierType: label });
    }
  }
  return { withEmail, missing };
}
