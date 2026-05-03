/**
 * Financial insight computations — derived from tours, invoices, payments.
 * Each helper returns a plain data structure, free of rendering concerns.
 *
 * Multi-currency safety: the insights dashboard is a single-currency
 * view at any given moment. Helpers accept an optional `currency`
 * filter and default to the most-common currency in the input set.
 * This prevents the historical bug where USD + LKR + EUR amounts
 * silently summed as if they were one currency, producing a
 * meaningless total on the dashboard.
 */

import type {
  HotelSupplier,
  Invoice,
  Payment,
  Tour,
} from "./types";

/**
 * Coerce any value to a finite non-negative number. Same guard
 * pattern used in package-price.ts and booking-pricing.ts. NaN /
 * undefined / negative collapse to 0 so a single corrupt row in the
 * payments table can't poison a whole dashboard total.
 */
function safeNum(v: unknown, fallback = 0): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return fallback;
  return v;
}

/** Pick the currency that appears most often in a payment list, or
 *  fall back to "USD" when the list is empty. Used to scope a
 *  dashboard view to one currency without making the caller pick. */
function dominantCurrency(items: { currency: string }[]): string {
  if (items.length === 0) return "USD";
  const counts = new Map<string, number>();
  for (const it of items) {
    counts.set(it.currency, (counts.get(it.currency) ?? 0) + 1);
  }
  let best = items[0].currency;
  let bestCount = -1;
  for (const [cur, count] of counts) {
    if (count > bestCount) {
      best = cur;
      bestCount = count;
    }
  }
  return best;
}

export interface SupplierSpendRow {
  supplierId: string;
  supplierName: string;
  type: string;
  total: number;
  paid: number;
  pending: number;
  currency: string;
  shareOfOutbound: number; // 0..1
}

/**
 * Roll up outgoing supplier payments by supplier within a single
 * currency. The currency is either the explicit `currency` arg or
 * (if omitted) the most-common currency across all outgoing payments.
 *
 * Skipped: payments in any other currency (counted in
 * `excludedCurrencies` so the UI can disclose them rather than
 * silently dropping them from the picture).
 */
export function getSupplierSpend(
  payments: Payment[],
  suppliers: HotelSupplier[],
  options?: { currency?: string }
): {
  rows: SupplierSpendRow[];
  totalOutbound: number;
  currency: string;
  excludedCurrencies: string[];
} {
  const outgoing = payments.filter((p) => p.type === "outgoing" && p.supplierId);
  const currency = options?.currency ?? dominantCurrency(outgoing);

  // Filter to the chosen currency. Anything else is set aside so we
  // can disclose it on the page rather than silently dropping it.
  const inCurrency = outgoing.filter((p) => p.currency === currency);
  const excludedSet = new Set<string>();
  for (const p of outgoing) {
    if (p.currency !== currency) excludedSet.add(p.currency);
  }

  const totalOutbound = inCurrency.reduce(
    (s, p) => s + safeNum(p.amount),
    0
  );

  const bySupplier = new Map<string, SupplierSpendRow>();
  for (const p of inCurrency) {
    const supplier = suppliers.find((s) => s.id === p.supplierId);
    const key = p.supplierId!;
    const amount = safeNum(p.amount);
    const existing = bySupplier.get(key);
    if (existing) {
      existing.total += amount;
      if (p.status === "completed") existing.paid += amount;
      else existing.pending += amount;
    } else {
      bySupplier.set(key, {
        supplierId: key,
        supplierName: p.supplierName || supplier?.name || "Unknown supplier",
        type: supplier?.type ?? "supplier",
        total: amount,
        paid: p.status === "completed" ? amount : 0,
        pending: p.status === "completed" ? 0 : amount,
        currency: p.currency,
        shareOfOutbound: 0,
      });
    }
  }
  const rows = Array.from(bySupplier.values())
    .map((r) => ({
      ...r,
      shareOfOutbound: totalOutbound > 0 ? r.total / totalOutbound : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    rows,
    totalOutbound,
    currency,
    excludedCurrencies: Array.from(excludedSet).sort(),
  };
}

export interface RevenueTrendPoint {
  month: string; // YYYY-MM
  revenue: number;
  tours: number;
  avgValue: number;
}

/**
 * Monthly revenue trend within a single currency. The currency is
 * either the explicit `currency` arg or the most-common currency
 * across all non-cancelled tours. Tours in any other currency are
 * counted in `excludedCurrencies`.
 */
export function getRevenueTrend(
  tours: Tour[],
  monthsBack = 6,
  options?: { currency?: string }
): {
  points: RevenueTrendPoint[];
  currency: string;
  excludedCurrencies: string[];
} {
  const eligible = tours.filter((t) => t.status !== "cancelled");
  const currency = options?.currency ?? dominantCurrency(eligible);

  const inCurrency = eligible.filter((t) => t.currency === currency);
  const excludedSet = new Set<string>();
  for (const t of eligible) {
    if (t.currency !== currency) excludedSet.add(t.currency);
  }

  const now = new Date();
  const points: RevenueTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({ month: key, revenue: 0, tours: 0, avgValue: 0 });
  }
  for (const t of inCurrency) {
    if (!t.startDate) continue;
    const key = t.startDate.slice(0, 7);
    const bucket = points.find((p) => p.month === key);
    if (!bucket) continue;
    bucket.revenue += safeNum(t.totalValue);
    bucket.tours += 1;
  }
  for (const p of points) {
    p.avgValue = p.tours > 0 ? Math.round(p.revenue / p.tours) : 0;
  }

  return {
    points,
    currency,
    excludedCurrencies: Array.from(excludedSet).sort(),
  };
}

export type AnomalyKind =
  | "overdue_invoice"
  | "unpaid_tour_after_start"
  | "supplier_pending_over_month"
  | "large_margin_drop"
  | "duplicate_pending_payment";

export interface Anomaly {
  kind: AnomalyKind;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  entityType?: string;
  entityId?: string;
}

export function detectAnomalies(input: {
  tours: Tour[];
  invoices: Invoice[];
  payments: Payment[];
}): Anomaly[] {
  const { tours, invoices, payments } = input;
  const anomalies: Anomaly[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const msDay = 24 * 60 * 60 * 1000;
  const monthAgo = new Date(Date.now() - 30 * msDay).toISOString().slice(0, 10);

  // Build a lookup of leadId → cancelled status so we don't surface
  // anomalies for cancelled bookings. Without this, an overdue
  // invoice for a cancelled tour was triggering a critical anomaly
  // even though admin had already deliberately cancelled the booking.
  const cancelledLeadIds = new Set(
    tours.filter((t) => t.status === "cancelled").map((t) => t.leadId)
  );

  // Overdue invoices — skip ones whose tour was cancelled.
  const overdue = invoices.filter(
    (i) => i.status === "overdue" && !cancelledLeadIds.has(i.leadId)
  );
  for (const inv of overdue) {
    anomalies.push({
      kind: "overdue_invoice",
      severity: "critical",
      title: `Invoice ${inv.invoiceNumber} overdue`,
      detail: `${safeNum(inv.totalAmount).toLocaleString()} ${inv.currency} owed by ${inv.clientName}`,
      entityType: "invoice",
      entityId: inv.id,
    });
  }

  // Unpaid tours whose start date has passed
  const unpaidActive = tours.filter(
    (t) => t.status !== "cancelled" && t.startDate <= today
  );
  for (const t of unpaidActive) {
    const invoice = invoices.find((i) => i.leadId === t.leadId);
    if (invoice && invoice.status !== "paid" && invoice.status !== "cancelled") {
      anomalies.push({
        kind: "unpaid_tour_after_start",
        severity: "warning",
        title: `Tour started without full payment`,
        detail: `${t.clientName} · ${t.packageName} · started ${t.startDate} · invoice ${invoice.invoiceNumber} still ${invoice.status.replace(/_/g, " ")}`,
        entityType: "tour",
        entityId: t.id,
      });
    }
  }

  // Supplier payables pending for more than 30 days
  const stalePendingSupplier = payments.filter(
    (p) =>
      p.type === "outgoing" &&
      p.status !== "completed" &&
      p.status !== "cancelled" &&
      !!p.date &&
      p.date < monthAgo
  );
  for (const p of stalePendingSupplier) {
    anomalies.push({
      kind: "supplier_pending_over_month",
      severity: "warning",
      title: `Supplier payable pending >30 days`,
      detail: `${p.supplierName ?? "Supplier"} · ${safeNum(p.amount).toLocaleString()} ${p.currency} · ${p.date}`,
      entityType: "payment",
      entityId: p.id,
    });
  }

  // Duplicate pending payments for the same tour
  const pendingByTour = new Map<string, number>();
  for (const p of payments) {
    if (p.type === "incoming" && p.status === "pending" && p.tourId) {
      pendingByTour.set(p.tourId, (pendingByTour.get(p.tourId) ?? 0) + 1);
    }
  }
  for (const [tourId, count] of pendingByTour) {
    if (count > 1) {
      anomalies.push({
        kind: "duplicate_pending_payment",
        severity: "info",
        title: `${count} pending incoming payments on one tour`,
        detail: `Tour ${tourId} — may indicate duplicates`,
        entityType: "tour",
        entityId: tourId,
      });
    }
  }

  return anomalies;
}
