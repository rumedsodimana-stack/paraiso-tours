import { NextRequest } from "next/server";
import {
  getLeads,
  getPackages,
  getTours,
  getEmployees,
  getInvoices,
  getPayments,
  getHotels,
} from "@/lib/db";

function match(q: string, ...values: (string | number | null | undefined)[]): boolean {
  const lower = q.toLowerCase().trim();
  if (!lower) return false;
  // Word-split: all query words must appear somewhere (high sensitivity)
  const words = lower.split(/\s+/).filter(Boolean);
  const haystack = values
    .filter((v): v is string | number => v != null && v !== "")
    .map((v) => String(v).toLowerCase())
    .join(" ");
  if (!haystack) return false;
  return words.every((w) => haystack.includes(w));
}

/** Single-word partial match for very short queries (1–2 chars) */
function matchPartial(q: string, ...values: (string | number | null | undefined)[]): boolean {
  const lower = q.toLowerCase().trim();
  if (!lower) return false;
  return values.some((v) =>
    v != null && String(v).toLowerCase().includes(lower)
  );
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return Response.json({ suggestions: [] });
  }
  const usePartial = q.length <= 2;
  const matcher = usePartial ? matchPartial : match;

  const [leads, packages, tours, employees, invoices, payments, hotels] =
    await Promise.all([
      getLeads(),
      getPackages(),
      getTours(),
      getEmployees(),
      getInvoices(),
      getPayments(),
      getHotels(),
    ]);

  const suggestions: {
    type: string;
    label: string;
    subtitle?: string;
    href: string;
  }[] = [];

  // Navigation shortcuts (high sensitivity to system structure)
  const navPages: { label: string; keywords: string[]; href: string }[] = [
    { label: "Bookings", keywords: ["booking", "bookings", "lead", "leads", "inquiry", "inquiries", "client"], href: "/admin/bookings" },
    { label: "Packages", keywords: ["package", "packages", "tour package", "trip", "destinations"], href: "/admin/packages" },
    { label: "Tours", keywords: ["tour", "tours", "scheduled", "itinerary", "calendar"], href: "/admin/tours" },
    { label: "Calendar", keywords: ["calendar", "schedule", "dates"], href: "/admin/calendar" },
    { label: "Invoices", keywords: ["invoice", "invoices", "bill", "billing"], href: "/admin/invoices" },
    { label: "Payments", keywords: ["payment", "payments", "transaction"], href: "/admin/payments" },
    { label: "Finance", keywords: ["finance", "revenue", "income"], href: "/admin/finance" },
    { label: "Payables", keywords: ["payables", "payable", "supplier payment", "outgoing"], href: "/admin/payables" },
    { label: "Payroll", keywords: ["payroll", "salary", "wages"], href: "/admin/payroll" },
    { label: "Employees", keywords: ["employee", "employees", "staff", "team"], href: "/admin/employees" },
    { label: "Suppliers", keywords: ["supplier", "suppliers", "hotel", "hotels", "vendor"], href: "/admin/hotels" },
    { label: "Quotations", keywords: ["quotation", "quotations", "quote", "proposal"], href: "/admin/quotations" },
    { label: "Settings", keywords: ["settings", "setting", "config"], href: "/admin/settings" },
    { label: "Dashboard", keywords: ["dashboard", "home", "overview"], href: "/admin" },
  ];
  const qLower = q.toLowerCase();
  for (const nav of navPages) {
    if (nav.keywords.some((kw) => kw.includes(qLower) || qLower.includes(kw))) {
      suggestions.push({ type: "page", label: nav.label, subtitle: "Go to page", href: nav.href });
    }
  }

  // Bookings (leads)
  for (const l of leads) {
    if (
      matcher(q, l.name, l.email, l.reference, l.destination, l.phone, l.notes, l.status)
    ) {
      suggestions.push({
        type: "booking",
        label: l.name || l.reference || "Booking",
        subtitle: l.reference || l.destination || l.email,
        href: `/admin/bookings/${l.id}`,
      });
    }
  }

  // Packages
  for (const p of packages) {
    if (
      matcher(q, p.name, p.description, p.region, p.destination, p.id, p.inclusions?.join(" "), p.exclusions?.join(" "))
    ) {
      suggestions.push({
        type: "package",
        label: p.name,
        subtitle: p.region || p.destination,
        href: `/admin/packages/${p.id}`,
      });
    }
  }

  // Tours
  for (const t of tours) {
    if (
      matcher(q, t.packageName, t.clientName, t.id, t.status)
    ) {
      suggestions.push({
        type: "tour",
        label: t.packageName,
        subtitle: `${t.clientName} · ${t.startDate}`,
        href: `/admin/tours/${t.id}`,
      });
    }
  }

  // Employees
  for (const e of employees) {
    if (matcher(q, e.name, e.email, e.role, e.department, e.id)) {
      suggestions.push({
        type: "employee",
        label: e.name,
        subtitle: e.role || e.department,
        href: `/admin/employees/${e.id}/edit`,
      });
    }
  }

  // Invoices
  for (const i of invoices) {
    if (
      matcher(q, i.clientName, i.invoiceNumber, i.reference, i.packageName, i.status, i.id)
    ) {
      suggestions.push({
        type: "invoice",
        label: i.clientName || i.invoiceNumber,
        subtitle: `${i.invoiceNumber} · ${i.status}`,
        href: `/admin/invoices/${i.id}`,
      });
    }
  }

  // Payments (transactions)
  for (const p of payments) {
    if (
      matcher(q, p.description, p.clientName, p.reference, p.id, p.status, p.supplierName)
    ) {
      suggestions.push({
        type: "payment",
        label: p.description || p.clientName || `Payment ${p.id.slice(-8)}`,
        subtitle: `${p.amount} ${p.currency} · ${p.status}`,
        href: `/admin/payments/${p.id}`,
      });
    }
  }

  // Hotels / suppliers
  for (const h of hotels) {
    if (matcher(q, h.name, h.location, h.type, h.contact, h.id)) {
      suggestions.push({
        type: "supplier",
        label: h.name,
        subtitle: h.location || h.type,
        href: `/admin/hotels/${h.id}`,
      });
    }
  }

  return Response.json({ suggestions: suggestions.slice(0, 16) });
}
