import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getInvoices,
  getLeads,
  getPayments,
  getPayrollRuns,
  getTours,
  getHotels,
} from "@/lib/db";
import { toCsv, csvResponse, type CsvRow } from "@/lib/csv";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

type ReportKind =
  | "pl"
  | "supplier_statement"
  | "booking_revenue"
  | "payroll_register";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = await verifyAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kind = (searchParams.get("kind") || "pl") as ReportKind;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const supplierId = searchParams.get("supplierId") || undefined;

  switch (kind) {
    case "pl":
      return plReport(from, to);
    case "supplier_statement":
      return supplierStatement(supplierId, from, to);
    case "booking_revenue":
      return bookingRevenue(from, to);
    case "payroll_register":
      return payrollRegister(from, to);
    default:
      return NextResponse.json({ ok: false, error: "Unknown report" }, { status: 400 });
  }
}

/**
 * Decide whether a row whose date is `iso` should appear in a report
 * bounded by [from, to]. Missing dates are **always excluded from bounded
 * reports** (so a payment with no date doesn't silently inflate a month's
 * totals) and **always included in unbounded reports** (so everything
 * still rolls up when no range is set). This is documented behavior.
 */
function dateInRange(iso: string | undefined, from?: string, to?: string): boolean {
  const bounded = !!from || !!to;
  const trimmed = iso?.trim();
  if (!trimmed) return !bounded;
  if (from && trimmed < from) return false;
  if (to && trimmed > to) return false;
  return true;
}

async function plReport(from?: string, to?: string) {
  const payments = await getPayments();
  let inbound = 0;
  let outbound = 0;
  const rows: CsvRow[] = [];
  for (const p of payments) {
    if (p.status !== "completed") continue;
    if (!dateInRange(p.date, from, to)) continue;
    if (p.type === "incoming") inbound += p.amount;
    else outbound += p.amount;
    rows.push({
      date: p.date ?? "",
      type: p.type,
      party: p.type === "incoming" ? p.clientName ?? "" : p.supplierName ?? "",
      description: p.description ?? "",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      reference: p.reference ?? "",
    });
  }

  rows.push({
    date: "",
    type: "",
    party: "TOTAL INBOUND",
    description: "",
    amount: inbound,
    currency: "",
    status: "",
    reference: "",
  });
  rows.push({
    date: "",
    type: "",
    party: "TOTAL OUTBOUND",
    description: "",
    amount: outbound,
    currency: "",
    status: "",
    reference: "",
  });
  rows.push({
    date: "",
    type: "",
    party: "NET",
    description: "",
    amount: inbound - outbound,
    currency: "",
    status: "",
    reference: "",
  });

  const csv = toCsv(rows, [
    "date",
    "type",
    "party",
    "description",
    "amount",
    "currency",
    "status",
    "reference",
  ]);
  return csvResponse(`pl_${from || "start"}_${to || "today"}.csv`, csv);
}

async function supplierStatement(
  supplierId: string | undefined,
  from?: string,
  to?: string
) {
  if (!supplierId) {
    return NextResponse.json(
      { ok: false, error: "supplierId required" },
      { status: 400 }
    );
  }
  const [payments, suppliers] = await Promise.all([getPayments(), getHotels()]);
  const supplier = suppliers.find((s) => s.id === supplierId);
  let total = 0;
  let paid = 0;
  let pending = 0;
  const rows: CsvRow[] = [];
  for (const p of payments) {
    if (p.type !== "outgoing" || p.supplierId !== supplierId) continue;
    if (!dateInRange(p.date, from, to)) continue;
    total += p.amount;
    if (p.status === "completed") paid += p.amount;
    else pending += p.amount;
    rows.push({
      date: p.date ?? "",
      description: p.description ?? "",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      reference: p.reference ?? "",
      tourId: p.tourId ?? "",
    });
  }
  rows.push({
    date: "",
    description: "TOTAL BILLED",
    amount: total,
    currency: "",
    status: "",
    reference: "",
    tourId: "",
  });
  rows.push({
    date: "",
    description: "PAID",
    amount: paid,
    currency: "",
    status: "",
    reference: "",
    tourId: "",
  });
  rows.push({
    date: "",
    description: "PENDING",
    amount: pending,
    currency: "",
    status: "",
    reference: "",
    tourId: "",
  });
  const csv = toCsv(rows, [
    "date",
    "description",
    "amount",
    "currency",
    "status",
    "reference",
    "tourId",
  ]);
  const name = (supplier?.name ?? "supplier").replace(/\s+/g, "_");
  return csvResponse(`supplier_${name}.csv`, csv);
}

async function bookingRevenue(from?: string, to?: string) {
  const [tours, leads, invoices] = await Promise.all([
    getTours(),
    getLeads(),
    getInvoices(),
  ]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const invoiceByLead = new Map(invoices.map((i) => [i.leadId, i]));
  const rows: CsvRow[] = [];
  for (const t of tours) {
    if (!dateInRange(t.startDate, from, to)) continue;
    const lead = leadById.get(t.leadId);
    const inv = invoiceByLead.get(t.leadId);
    rows.push({
      tourId: t.id,
      confirmationId: t.confirmationId ?? "",
      reference: lead?.reference ?? "",
      package: t.packageName,
      client: t.clientName,
      start: t.startDate,
      end: t.endDate,
      pax: t.pax,
      totalValue: t.totalValue,
      currency: t.currency,
      status: t.status,
      invoice: inv?.invoiceNumber ?? "",
      invoiceStatus: inv?.status ?? "",
    });
  }
  const csv = toCsv(rows, [
    "tourId",
    "confirmationId",
    "reference",
    "package",
    "client",
    "start",
    "end",
    "pax",
    "totalValue",
    "currency",
    "status",
    "invoice",
    "invoiceStatus",
  ]);
  return csvResponse("booking_revenue.csv", csv);
}

async function payrollRegister(from?: string, to?: string) {
  const runs = await getPayrollRuns();
  const rows: CsvRow[] = [];
  for (const run of runs) {
    if (!dateInRange(run.payDate, from, to)) continue;
    for (const item of run.items ?? []) {
      rows.push({
        run: run.id,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        payDate: run.payDate,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        gross: item.grossAmount,
        tax: item.taxAmount,
        benefits: item.benefitsAmount,
        net: item.netAmount,
        currency: run.currency,
        status: run.status,
      });
    }
  }
  const csv = toCsv(rows, [
    "run",
    "periodStart",
    "periodEnd",
    "payDate",
    "employeeId",
    "employeeName",
    "gross",
    "tax",
    "benefits",
    "net",
    "currency",
    "status",
  ]);
  return csvResponse("payroll_register.csv", csv);
}
