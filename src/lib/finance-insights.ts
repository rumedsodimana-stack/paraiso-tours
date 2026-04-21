/**
 * Financial insight computations — derived from tours, invoices, payments.
 * Each helper returns a plain data structure, free of rendering concerns.
 */

import type {
  HotelSupplier,
  Invoice,
  Payment,
  Tour,
} from "./types";

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

export function getSupplierSpend(
  payments: Payment[],
  suppliers: HotelSupplier[]
): { rows: SupplierSpendRow[]; totalOutbound: number; currency: string } {
  const outgoing = payments.filter((p) => p.type === "outgoing" && p.supplierId);
  const currency = outgoing[0]?.currency ?? "USD";
  const totalOutbound = outgoing.reduce((s, p) => s + p.amount, 0);
  const bySupplier = new Map<string, SupplierSpendRow>();
  for (const p of outgoing) {
    const supplier = suppliers.find((s) => s.id === p.supplierId);
    const key = p.supplierId!;
    const existing = bySupplier.get(key);
    if (existing) {
      existing.total += p.amount;
      if (p.status === "completed") existing.paid += p.amount;
      else existing.pending += p.amount;
    } else {
      bySupplier.set(key, {
        supplierId: key,
        supplierName: p.supplierName || supplier?.name || "Unknown supplier",
        type: supplier?.type ?? "supplier",
        total: p.amount,
        paid: p.status === "completed" ? p.amount : 0,
        pending: p.status === "completed" ? 0 : p.amount,
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
  return { rows, totalOutbound, currency };
}

export interface RevenueTrendPoint {
  month: string; // YYYY-MM
  revenue: number;
  tours: number;
  avgValue: number;
}

export function getRevenueTrend(tours: Tour[], monthsBack = 6): RevenueTrendPoint[] {
  const now = new Date();
  const points: RevenueTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({ month: key, revenue: 0, tours: 0, avgValue: 0 });
  }
  for (const t of tours) {
    if (t.status === "cancelled") continue;
    const key = t.startDate.slice(0, 7);
    const bucket = points.find((p) => p.month === key);
    if (!bucket) continue;
    bucket.revenue += t.totalValue;
    bucket.tours += 1;
  }
  for (const p of points) {
    p.avgValue = p.tours > 0 ? Math.round(p.revenue / p.tours) : 0;
  }
  return points;
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

  // Overdue invoices
  const overdue = invoices.filter((i) => i.status === "overdue");
  for (const inv of overdue) {
    anomalies.push({
      kind: "overdue_invoice",
      severity: "critical",
      title: `Invoice ${inv.invoiceNumber} overdue`,
      detail: `${inv.totalAmount.toLocaleString()} ${inv.currency} owed by ${inv.clientName}`,
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
      detail: `${p.supplierName ?? "Supplier"} · ${p.amount.toLocaleString()} ${p.currency} · ${p.date}`,
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
