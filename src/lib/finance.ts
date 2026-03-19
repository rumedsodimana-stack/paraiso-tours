import type {
  HotelSupplier,
  Invoice,
  Lead,
  Payment,
  Tour,
  TourPackage,
} from "./types";
import { getPayablesForDateRange, getCostForTour } from "./payables";

export interface FinanceKPIs {
  cash: number;
  receivables: number;
  payables: number;
  revenue: number;
  margin: number;
  currency: string;
}

export interface CashFlowPoint {
  month: string;
  incoming: number;
  outgoing: number;
  net: number;
}

export interface RevenueCostPoint {
  month: string;
  revenue: number;
  cost: number;
  margin: number;
}

export interface AgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

interface FinanceLookupInput {
  getLead: (id: string) => Promise<Lead | null>;
  getPackage: (id: string) => Promise<TourPackage | null>;
  suppliers: HotelSupplier[];
}

/**
 * Compute finance KPIs from tours, invoices, payables, and payments.
 */
export async function getFinanceKPIs(input: {
  tours: Tour[];
  invoices: Invoice[];
  payments: Payment[];
} & FinanceLookupInput): Promise<FinanceKPIs> {
  const { tours, invoices, payments, getLead, getPackage, suppliers } = input;
  const activeTours = tours.filter((t) => t.status !== "cancelled");
  const future = new Date();
  future.setFullYear(future.getFullYear() + 2);
  const endDate = future.toISOString().slice(0, 10);

  const payables = await getPayablesForDateRange({
    tours: activeTours,
    getLead,
    getPackage,
    suppliers,
    startDate: "2020-01-01",
    endDate,
  });

  const totalPayables = payables.reduce((s, p) => s + p.amount, 0);
  const revenue = activeTours.reduce((s, t) => s + t.totalValue, 0);
  const margin = revenue - totalPayables;

  const receivables = invoices
    .filter((i) => i.status === "pending_payment" || i.status === "overdue")
    .reduce((s, i) => s + i.totalAmount, 0);

  const completedIncoming = payments
    .filter((p) => p.type === "incoming" && p.status === "completed")
    .reduce((s, p) => s + p.amount, 0);
  const completedOutgoing = payments
    .filter((p) => p.type === "outgoing" && p.status === "completed")
    .reduce((s, p) => s + p.amount, 0);
  const cash = completedIncoming - completedOutgoing;

  return {
    cash,
    receivables,
    payables: totalPayables,
    revenue,
    margin,
    currency: "USD",
  };
}

/**
 * Cash flow by month (incoming vs outgoing from payments).
 */
export function getCashFlowData(payments: Payment[], months = 6): CashFlowPoint[] {
  const points: CashFlowPoint[] = [];
  const now = new Date();
  const byMonth = new Map<string, { in: number; out: number }>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, { in: 0, out: 0 });
  }

  for (const p of payments) {
    if (p.status !== "completed") continue;
    const key = p.date.slice(0, 7);
    const curr = byMonth.get(key);
    if (!curr) continue;
    if (p.type === "incoming") curr.in += p.amount;
    else curr.out += p.amount;
  }

  for (const [month, data] of byMonth.entries()) {
    points.push({
      month,
      incoming: data.in,
      outgoing: data.out,
      net: data.in - data.out,
    });
  }
  return points;
}

/**
 * Revenue vs cost by month from tours and payables.
 */
export async function getRevenueCostData(
  input: {
    tours: Tour[];
  } & FinanceLookupInput,
  months = 6
): Promise<RevenueCostPoint[]> {
  const { tours, getLead, getPackage, suppliers } = input;
  const now = new Date();
  const points: RevenueCostPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const monthKey = startDate.slice(0, 7);

    const monthTours = tours.filter(
      (t) => t.status !== "cancelled" && t.startDate >= startDate && t.startDate <= endDate
    );
    const revenue = monthTours.reduce((s, t) => s + t.totalValue, 0);

    const payables = await getPayablesForDateRange({
      tours,
      getLead,
      getPackage,
      suppliers,
      startDate,
      endDate,
    });
    const cost = payables.reduce((s, p) => s + p.amount, 0);

    points.push({
      month: monthKey,
      revenue,
      cost,
      margin: revenue - cost,
    });
  }
  return points;
}

/**
 * Receivables aging (0-30, 31-60, 61-90, 90+ days overdue).
 */
export function getReceivablesAging(invoices: Invoice[]): AgingBucket[] {
  const pending = invoices.filter((i) => i.status === "pending_payment" || i.status === "overdue");
  const today = new Date().getTime();
  const buckets: Record<string, { amount: number; count: number }> = {
    "0–30": { amount: 0, count: 0 },
    "31–60": { amount: 0, count: 0 },
    "61–90": { amount: 0, count: 0 },
    "90+": { amount: 0, count: 0 },
  };

  for (const inv of pending) {
    const created = new Date(inv.createdAt).getTime();
    const days = Math.floor((today - created) / (1000 * 60 * 60 * 24));
    let key: keyof typeof buckets;
    if (days <= 30) key = "0–30";
    else if (days <= 60) key = "31–60";
    else if (days <= 90) key = "61–90";
    else key = "90+";
    buckets[key].amount += inv.totalAmount;
    buckets[key].count += 1;
  }

  return Object.entries(buckets).map(([bucket, data]) => ({
    bucket: `${bucket} days`,
    amount: data.amount,
    count: data.count,
  }));
}

// --- Revenue analytics ---

export interface MarginByPackage {
  packageId: string;
  packageName: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  tourCount: number;
}

export interface MarginByTour {
  tourId: string;
  clientName: string;
  packageName: string;
  startDate: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

export interface ConversionFunnelStep {
  status: string;
  label: string;
  count: number;
}

export interface RevenueBySource {
  source: string;
  revenue: number;
  tourCount: number;
}

export async function getMarginByPackage(input: {
  tours: Tour[];
  getLead: (id: string) => Promise<Lead | null>;
  getPackage: (id: string) => Promise<TourPackage | null>;
  suppliers: HotelSupplier[];
}): Promise<MarginByPackage[]> {
  const { tours, getLead, getPackage, suppliers } = input;
  const activeTours = tours.filter((t) => t.status !== "cancelled");
  const byPkg = new Map<string, { revenue: number; cost: number; tourCount: number; packageName: string }>();

  for (const tour of activeTours) {
    const cost = await getCostForTour(tour, getLead, getPackage, suppliers);
    const pkg = byPkg.get(tour.packageId);
    const pkgData = await getPackage(tour.packageId);
    const name = pkgData?.name ?? tour.packageName;
    if (pkg) {
      pkg.revenue += tour.totalValue;
      pkg.cost += cost;
      pkg.tourCount += 1;
    } else {
      byPkg.set(tour.packageId, { revenue: tour.totalValue, cost, tourCount: 1, packageName: name });
    }
  }

  return Array.from(byPkg.entries()).map(([packageId, data]) => {
    const margin = data.revenue - data.cost;
    const marginPct = data.revenue > 0 ? (margin / data.revenue) * 100 : 0;
    return { packageId, packageName: data.packageName, revenue: data.revenue, cost: data.cost, margin, marginPct, tourCount: data.tourCount };
  }).sort((a, b) => b.revenue - a.revenue);
}

export async function getMarginByTour(input: {
  tours: Tour[];
  getLead: (id: string) => Promise<Lead | null>;
  getPackage: (id: string) => Promise<TourPackage | null>;
  suppliers: HotelSupplier[];
}): Promise<MarginByTour[]> {
  const { tours, getLead, getPackage, suppliers } = input;
  const activeTours = tours.filter((t) => t.status !== "cancelled");
  const result: MarginByTour[] = [];

  for (const tour of activeTours) {
    const cost = await getCostForTour(tour, getLead, getPackage, suppliers);
    const margin = tour.totalValue - cost;
    const marginPct = tour.totalValue > 0 ? (margin / tour.totalValue) * 100 : 0;
    result.push({
      tourId: tour.id,
      clientName: tour.clientName,
      packageName: tour.packageName,
      startDate: tour.startDate,
      revenue: tour.totalValue,
      cost,
      margin,
      marginPct,
    });
  }

  return result.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function getConversionFunnel(leads: { status: string }[]): ConversionFunnelStep[] {
  const statusOrder = ["new", "contacted", "quoted", "negotiating", "won", "lost"];
  const labels: Record<string, string> = { new: "New", contacted: "Contacted", quoted: "Quoted", negotiating: "Negotiating", won: "Won", lost: "Lost" };
  const byStatus = new Map<string, number>();
  for (const s of statusOrder) byStatus.set(s, 0);
  for (const l of leads) {
    const c = byStatus.get(l.status) ?? 0;
    byStatus.set(l.status, c + 1);
  }
  return statusOrder.map((status) => ({ status, label: labels[status] ?? status, count: byStatus.get(status) ?? 0 }));
}

export function getRevenueBySource(tours: Tour[], leads: { id: string; source: string }[]): RevenueBySource[] {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const bySource = new Map<string, { revenue: number; tourCount: number }>();
  const activeTours = tours.filter((t) => t.status !== "cancelled");

  for (const tour of activeTours) {
    const lead = leadById.get(tour.leadId);
    const source = lead?.source ?? "Unknown";
    const curr = bySource.get(source);
    if (curr) {
      curr.revenue += tour.totalValue;
      curr.tourCount += 1;
    } else {
      bySource.set(source, { revenue: tour.totalValue, tourCount: 1 });
    }
  }

  return Array.from(bySource.entries())
    .map(([source, data]) => ({ source, revenue: data.revenue, tourCount: data.tourCount }))
    .sort((a, b) => b.revenue - a.revenue);
}
