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
import {
  generateReportPdf,
  type ReportColumn,
  type ReportRow,
  type ReportSummaryStat,
  type GenerateReportPdfInput,
} from "@/lib/report-pdf";

type ReportKind =
  | "pl"
  | "supplier_statement"
  | "booking_revenue"
  | "payroll_register";

type Format = "csv" | "pdf";

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
  const format = (searchParams.get("format") || "csv") as Format;

  switch (kind) {
    case "pl":
      return plReport(from, to, format);
    case "supplier_statement":
      return supplierStatement(supplierId, from, to, format);
    case "booking_revenue":
      return bookingRevenue(from, to, format);
    case "payroll_register":
      return payrollRegister(from, to, format);
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

/**
 * Helper: serialize a number as a localised string. Used in PDF
 * cells so 12345 reads as "12,345".
 */
function fmtNum(n: number): string {
  return n.toLocaleString();
}

/**
 * Helper: format a multi-currency total when payments could be in
 * mixed currencies. For single-currency reports, just shows the
 * amount + currency. For mixed, shows the sum-by-currency separated
 * by space.
 */
function fmtCurrencyTotals(
  totals: Record<string, number>,
  fallbackCurrency = ""
): string {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0);
  if (entries.length === 0) return fallbackCurrency ? `0 ${fallbackCurrency}` : "0";
  return entries.map(([cur, val]) => `${fmtNum(val)} ${cur}`).join("  ");
}

/**
 * Wrap a PDF buffer as a NextResponse with the right headers.
 */
function pdfResponse(filename: string, pdf: Buffer): NextResponse {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function plReport(from?: string, to?: string, format: Format = "csv") {
  const payments = await getPayments();
  const inboundByCur: Record<string, number> = {};
  const outboundByCur: Record<string, number> = {};
  const csvRows: CsvRow[] = [];
  const pdfRows: ReportRow[] = [];

  for (const p of payments) {
    if (p.status !== "completed") continue;
    if (!dateInRange(p.date, from, to)) continue;
    if (p.type === "incoming") {
      inboundByCur[p.currency] = (inboundByCur[p.currency] ?? 0) + p.amount;
    } else {
      outboundByCur[p.currency] = (outboundByCur[p.currency] ?? 0) + p.amount;
    }
    csvRows.push({
      date: p.date ?? "",
      type: p.type,
      party: p.type === "incoming" ? p.clientName ?? "" : p.supplierName ?? "",
      description: p.description ?? "",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      reference: p.reference ?? "",
    });
    pdfRows.push({
      date: p.date ?? "—",
      type: p.type === "incoming" ? "In" : "Out",
      party: p.type === "incoming" ? p.clientName ?? "" : p.supplierName ?? "",
      description: p.description ?? "",
      amount: `${p.type === "outgoing" ? "−" : ""}${fmtNum(p.amount)} ${p.currency}`,
    });
  }

  const inbound = Object.values(inboundByCur).reduce((a, b) => a + b, 0);
  const outbound = Object.values(outboundByCur).reduce((a, b) => a + b, 0);

  // Totals as CSV rows preserved for backwards-compat with anything
  // that parses our CSVs.
  csvRows.push(
    {
      date: "",
      type: "",
      party: "TOTAL INBOUND",
      description: "",
      amount: inbound,
      currency: "",
      status: "",
      reference: "",
    },
    {
      date: "",
      type: "",
      party: "TOTAL OUTBOUND",
      description: "",
      amount: outbound,
      currency: "",
      status: "",
      reference: "",
    },
    {
      date: "",
      type: "",
      party: "NET",
      description: "",
      amount: inbound - outbound,
      currency: "",
      status: "",
      reference: "",
    }
  );

  if (format === "csv") {
    const csv = toCsv(csvRows, [
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

  // PDF: stat cards + zebra-row table + highlight rows for totals.
  const stats: ReportSummaryStat[] = [
    { label: "Inbound", value: fmtCurrencyTotals(inboundByCur) },
    { label: "Outbound", value: fmtCurrencyTotals(outboundByCur) },
    {
      label: "Net",
      value: fmtCurrencyTotals(
        netByCurrency(inboundByCur, outboundByCur)
      ),
      emphasis: true,
    },
  ];
  const columns: ReportColumn[] = [
    { key: "date", label: "Date", width: 0.13 },
    { key: "type", label: "Type", width: 0.07 },
    { key: "party", label: "Party", width: 0.27 },
    { key: "description", label: "Description", width: 0.33 },
    { key: "amount", label: "Amount", width: 0.2, align: "right", numeric: true },
  ];
  const pdf = await generateReportPdfWithDefaults({
    kicker: "Profit & Loss",
    title: "P&L statement",
    dateRange: { from, to },
    stats,
    columns,
    rows: pdfRows,
    footnote:
      "Includes only payments with status = completed. Net is computed per-currency; totals shown side-by-side when more than one currency is involved.",
  });
  return pdfResponse(`pl_${from || "start"}_${to || "today"}.pdf`, pdf);
}

function netByCurrency(
  inbound: Record<string, number>,
  outbound: Record<string, number>
): Record<string, number> {
  const all: Record<string, number> = { ...inbound };
  for (const [cur, val] of Object.entries(outbound)) {
    all[cur] = (all[cur] ?? 0) - val;
  }
  return all;
}

async function supplierStatement(
  supplierId: string | undefined,
  from?: string,
  to?: string,
  format: Format = "csv"
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
  let cur = "";
  const csvRows: CsvRow[] = [];
  const pdfRows: ReportRow[] = [];

  for (const p of payments) {
    if (p.type !== "outgoing" || p.supplierId !== supplierId) continue;
    if (!dateInRange(p.date, from, to)) continue;
    total += p.amount;
    if (p.status === "completed") paid += p.amount;
    else pending += p.amount;
    cur = p.currency;
    csvRows.push({
      date: p.date ?? "",
      description: p.description ?? "",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      reference: p.reference ?? "",
      tourId: p.tourId ?? "",
    });
    pdfRows.push({
      date: p.date ?? "—",
      description: p.description ?? "",
      reference: p.reference ?? "",
      status: p.status === "completed" ? "Paid" : p.status === "pending" ? "Pending" : "Cancelled",
      amount: `${fmtNum(p.amount)} ${p.currency}`,
    });
  }
  csvRows.push(
    { date: "", description: "TOTAL BILLED", amount: total, currency: "", status: "", reference: "", tourId: "" },
    { date: "", description: "PAID", amount: paid, currency: "", status: "", reference: "", tourId: "" },
    { date: "", description: "PENDING", amount: pending, currency: "", status: "", reference: "", tourId: "" }
  );

  if (format === "csv") {
    const csvBody = toCsv(csvRows, [
      "date",
      "description",
      "amount",
      "currency",
      "status",
      "reference",
      "tourId",
    ]);
    const name = (supplier?.name ?? "supplier").replace(/\s+/g, "_");
    return csvResponse(`supplier_${name}.csv`, csvBody);
  }

  const stats: ReportSummaryStat[] = [
    { label: "Total billed", value: cur ? `${fmtNum(total)} ${cur}` : fmtNum(total) },
    { label: "Paid", value: cur ? `${fmtNum(paid)} ${cur}` : fmtNum(paid) },
    {
      label: "Outstanding",
      value: cur ? `${fmtNum(pending)} ${cur}` : fmtNum(pending),
      emphasis: pending > 0,
    },
  ];
  const columns: ReportColumn[] = [
    { key: "date", label: "Date", width: 0.13 },
    { key: "description", label: "Description", width: 0.42 },
    { key: "reference", label: "Reference", width: 0.18 },
    { key: "status", label: "Status", width: 0.12 },
    { key: "amount", label: "Amount", width: 0.15, align: "right", numeric: true },
  ];
  const pdf = await generateReportPdfWithDefaults({
    kicker: "Supplier statement",
    title: supplier?.name ?? "Supplier statement",
    subtitle: supplier?.type
      ? `${supplier.type[0].toUpperCase() + supplier.type.slice(1)} supplier`
      : undefined,
    dateRange: { from, to },
    stats,
    columns,
    rows: pdfRows,
    footnote:
      pending > 0
        ? `Outstanding amount of ${cur ? `${fmtNum(pending)} ${cur}` : fmtNum(pending)} represents payments still pending.`
        : "All recorded amounts have been settled.",
  });
  const name = (supplier?.name ?? "supplier").replace(/\s+/g, "_");
  return pdfResponse(`supplier_${name}.pdf`, pdf);
}

async function bookingRevenue(
  from?: string,
  to?: string,
  format: Format = "csv"
) {
  const [tours, leads, invoices] = await Promise.all([
    getTours(),
    getLeads(),
    getInvoices(),
  ]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const invoiceByLead = new Map(invoices.map((i) => [i.leadId, i]));
  const csvRows: CsvRow[] = [];
  const pdfRows: ReportRow[] = [];
  const totalsByCurrency: Record<string, number> = {};
  let totalPax = 0;
  let tourCount = 0;

  for (const t of tours) {
    if (!dateInRange(t.startDate, from, to)) continue;
    const lead = leadById.get(t.leadId);
    const inv = invoiceByLead.get(t.leadId);
    csvRows.push({
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
    pdfRows.push({
      start: t.startDate,
      reference:
        t.confirmationId || lead?.reference || t.id.slice(-6),
      client: t.clientName,
      package: t.packageName,
      pax: t.pax,
      total: `${fmtNum(t.totalValue)} ${t.currency}`,
      status: t.status,
    });
    totalsByCurrency[t.currency] =
      (totalsByCurrency[t.currency] ?? 0) + t.totalValue;
    totalPax += t.pax;
    tourCount += 1;
  }

  if (format === "csv") {
    const csv = toCsv(csvRows, [
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

  const stats: ReportSummaryStat[] = [
    { label: "Tours", value: String(tourCount) },
    { label: "Travellers", value: String(totalPax) },
    {
      label: "Revenue",
      value: fmtCurrencyTotals(totalsByCurrency),
      emphasis: true,
    },
  ];
  const columns: ReportColumn[] = [
    { key: "start", label: "Start", width: 0.12 },
    { key: "reference", label: "Reference", width: 0.16 },
    { key: "client", label: "Client", width: 0.22 },
    { key: "package", label: "Package", width: 0.22 },
    { key: "pax", label: "Pax", width: 0.07, align: "right" },
    { key: "total", label: "Total", width: 0.16, align: "right", numeric: true },
    { key: "status", label: "Status", width: 0.05 },
  ];
  const pdf = await generateReportPdfWithDefaults({
    kicker: "Booking revenue",
    title: "Booking revenue",
    dateRange: { from, to },
    stats,
    columns,
    rows: pdfRows,
    footnote:
      "Tours are included by start date. Revenue figures are gross — supplier costs are tracked separately under Payables.",
  });
  return pdfResponse(`booking_revenue_${from || "start"}_${to || "today"}.pdf`, pdf);
}

async function payrollRegister(
  from?: string,
  to?: string,
  format: Format = "csv"
) {
  const runs = await getPayrollRuns();
  const csvRows: CsvRow[] = [];
  const pdfRows: ReportRow[] = [];
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  let cur = "";
  let employeeCount = 0;

  for (const run of runs) {
    if (!dateInRange(run.payDate, from, to)) continue;
    cur = run.currency;
    for (const item of run.items ?? []) {
      csvRows.push({
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
      pdfRows.push({
        payDate: run.payDate,
        employeeName: item.employeeName,
        period: `${run.periodStart} → ${run.periodEnd}`,
        gross: `${fmtNum(item.grossAmount)} ${run.currency}`,
        net: `${fmtNum(item.netAmount)} ${run.currency}`,
        status: run.status,
      });
      totalGross += item.grossAmount;
      totalTax += item.taxAmount;
      totalNet += item.netAmount;
      employeeCount += 1;
    }
  }

  if (format === "csv") {
    const csv = toCsv(csvRows, [
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

  const stats: ReportSummaryStat[] = [
    { label: "Pay items", value: String(employeeCount) },
    { label: "Total gross", value: cur ? `${fmtNum(totalGross)} ${cur}` : fmtNum(totalGross) },
    {
      label: "Total net",
      value: cur ? `${fmtNum(totalNet)} ${cur}` : fmtNum(totalNet),
      emphasis: true,
    },
  ];
  const columns: ReportColumn[] = [
    { key: "payDate", label: "Pay date", width: 0.13 },
    { key: "employeeName", label: "Employee", width: 0.27 },
    { key: "period", label: "Period", width: 0.25 },
    { key: "gross", label: "Gross", width: 0.15, align: "right", numeric: true },
    { key: "net", label: "Net", width: 0.15, align: "right", numeric: true },
    { key: "status", label: "Status", width: 0.05 },
  ];
  const pdf = await generateReportPdfWithDefaults({
    kicker: "Payroll register",
    title: "Payroll register",
    dateRange: { from, to },
    stats,
    columns,
    rows: pdfRows,
    footnote: `Across ${runs.filter((r) => dateInRange(r.payDate, from, to)).length} run${
      runs.filter((r) => dateInRange(r.payDate, from, to)).length === 1 ? "" : "s"
    }. Tax withheld from gross totals: ${cur ? `${fmtNum(totalTax)} ${cur}` : fmtNum(totalTax)}.`,
  });
  return pdfResponse(`payroll_${from || "start"}_${to || "today"}.pdf`, pdf);
}

/**
 * Wrapper around generateReportPdf that adds typing for the input.
 * Kept thin so the report-pdf module stays the source of truth for
 * layout, while this file owns data shaping.
 */
async function generateReportPdfWithDefaults(
  input: GenerateReportPdfInput
): Promise<Buffer> {
  return generateReportPdf(input);
}
