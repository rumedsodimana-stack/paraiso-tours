import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  FileText,
  Inbox,
  Mail,
  Sparkles,
} from "lucide-react";
import { getAuditLogs, getLeads, getTours } from "@/lib/db";
import type { AuditLog, Lead, Tour } from "@/lib/types";
import { CommunicationsFilters } from "./CommunicationsFilters";
import { ResendEmailButton } from "./ResendEmailButton";
import { BulkRetryButton } from "./BulkRetryButton";

export const dynamic = "force-dynamic";

type MessageStatus = "sent" | "failed" | "skipped";
type MessageTemplate =
  | "tour_confirmation_with_invoice"
  | "supplier_reservation"
  | "payment_receipt"
  | "invoice"
  | "itinerary"
  | "pre_trip_reminder"
  | "post_trip_followup"
  | "booking_revision"
  | "booking_cancellation"
  | "booking_request_confirmation"
  | "quotation"
  | "supplier_remittance"
  | "supplier_schedule_update"
  | "supplier_cancellation"
  | "internal_new_booking"
  | "other";

type DateRange = "today" | "7d" | "30d" | "90d" | "all";

interface MessageRow {
  id: string;
  createdAt: string;
  status: MessageStatus;
  template: MessageTemplate;
  templateLabel: string;
  recipient: string;
  summary: string;
  error?: string;
  entityType: AuditLog["entityType"];
  entityId: string;
  tourId?: string;
  leadId?: string;
  invoiceId?: string;
  paymentId?: string;
  supplierName?: string;
}

// Audit `action` strings that represent an outbound email event. Kept
// in sync with every `recordAuditEvent({ action: ... })` call across
// the codebase that emits an email — see /actions/{tours,invoices,
// communications,client-booking}.ts. Adding a new email type? Add the
// matching `*_emailed`/`*_email_failed`/`*_email_skipped` action here
// AND extend `MessageTemplate` + `templateFromMetadata` below so the
// row renders with a real label instead of "Other".
const EMAIL_ACTIONS = new Set([
  "guest_confirmation_emailed",
  "guest_confirmation_email_failed",
  "supplier_reservation_emailed",
  "supplier_reservation_email_failed",
  "supplier_reservation_email_skipped",
  "payment_receipt_emailed",
  "payment_receipt_email_failed",
  "invoice_emailed",
  "invoice_email_failed",
  "itinerary_emailed",
  "itinerary_email_failed",
  "pre_trip_reminder_emailed",
  "pre_trip_reminder_email_failed",
  "post_trip_followup_emailed",
  "post_trip_followup_email_failed",
  "booking_change_notice_emailed",
  "booking_change_notice_email_failed",
  "remittance_emailed",
  "remittance_email_failed",
  "supplier_change_notice_emailed",
  "supplier_change_notice_email_failed",
  // Auto-confirmation sent to a guest the moment they finish booking
  // from the public client portal (both the package wizard and the
  // custom journey flow). See client-booking.ts + custom-route-request.ts.
  "booking_request_confirmation_emailed",
  "booking_request_confirmation_email_failed",
  // Quotation email when an admin clicks "send" in /admin/quotations.
  "quotation_emailed",
  "quotation_email_failed",
  // Cancellation notice fired when a lead's status flips to cancelled.
  // `*_skipped` covers the case where the booking has no client email
  // on file — we still want a row in the inbox so the admin knows to
  // follow up by phone/WhatsApp instead of silently dropping it.
  "booking_cancellation_emailed",
  "booking_cancellation_email_failed",
  "booking_cancellation_email_skipped",
  // Internal alert when a client books from the public site — uses a
  // bespoke action name (not the *_emailed pattern) but still flows to
  // an admin inbox so it belongs in this view.
  "admin_new_booking_alert_sent",
]);

function templateFromMetadata(meta: Record<string, unknown> | undefined): MessageTemplate {
  const t = meta?.template;
  if (typeof t !== "string") return "other";
  switch (t) {
    case "tour_confirmation_with_invoice":
    case "supplier_reservation":
    case "payment_receipt":
    case "invoice":
    case "itinerary":
    case "pre_trip_reminder":
    case "post_trip_followup":
    case "booking_revision":
    case "booking_cancellation":
    case "booking_request_confirmation":
    case "quotation":
    case "supplier_remittance":
    case "supplier_schedule_update":
    case "supplier_cancellation":
    case "internal_new_booking":
      return t;
    default:
      return "other";
  }
}

function templateLabel(t: MessageTemplate) {
  switch (t) {
    case "tour_confirmation_with_invoice":
      return "Tour confirmation (with invoice)";
    case "supplier_reservation":
      return "Supplier reservation";
    case "payment_receipt":
      return "Payment receipt";
    case "invoice":
      return "Invoice";
    case "itinerary":
      return "Itinerary";
    case "pre_trip_reminder":
      return "Pre-trip reminder";
    case "post_trip_followup":
      return "Post-trip follow-up";
    case "booking_revision":
      return "Booking revision";
    case "booking_cancellation":
      return "Booking cancellation";
    case "booking_request_confirmation":
      return "Booking request confirmation";
    case "quotation":
      return "Quotation";
    case "supplier_remittance":
      return "Supplier remittance";
    case "supplier_schedule_update":
      return "Supplier schedule update";
    case "supplier_cancellation":
      return "Supplier cancellation";
    case "internal_new_booking":
      return "Internal new-booking alert";
    default:
      return "Other";
  }
}

// Normalize the `range` searchParam — anything we don't recognize falls
// back to the 30-day default so a typo'd URL doesn't spam an admin with
// every email ever sent.
function parseRange(raw: string | undefined): DateRange {
  if (raw === "today" || raw === "7d" || raw === "30d" || raw === "90d" || raw === "all") {
    return raw;
  }
  return "30d";
}

function rangeCutoffMs(range: DateRange): number | null {
  if (range === "all") return null;
  const now = Date.now();
  if (range === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return now - days * 24 * 60 * 60 * 1000;
}

function toMessageRow(log: AuditLog): MessageRow | null {
  if (!EMAIL_ACTIONS.has(log.action)) return null;
  const meta = log.metadata ?? {};
  const status: MessageStatus = log.action.endsWith("_failed")
    ? "failed"
    : log.action.endsWith("_skipped")
      ? "skipped"
      : "sent";
  const recipient =
    typeof meta.recipient === "string" && meta.recipient.trim()
      ? meta.recipient.trim()
      : "—";
  const template = templateFromMetadata(meta);
  const row: MessageRow = {
    id: log.id,
    createdAt: log.createdAt,
    status,
    template,
    templateLabel: templateLabel(template),
    recipient,
    summary: log.summary,
    error: typeof meta.error === "string" ? meta.error : undefined,
    entityType: log.entityType,
    entityId: log.entityId,
    supplierName: typeof meta.supplierName === "string" ? meta.supplierName : undefined,
  };
  if (log.entityType === "tour") {
    row.tourId = log.entityId;
  } else if (log.entityType === "lead") {
    row.leadId = log.entityId;
  } else if (log.entityType === "invoice") {
    row.invoiceId = log.entityId;
  } else if (log.entityType === "payment") {
    row.paymentId = log.entityId;
  }
  return row;
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    template?: string;
    q?: string;
    range?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const statusFilter =
    sp.status === "failed"
      ? "failed"
      : sp.status === "sent"
        ? "sent"
        : sp.status === "skipped"
          ? "skipped"
          : "all";
  const templateFilter = sp.template ?? "all";
  const query = (sp.q ?? "").trim().toLowerCase();
  const range = parseRange(sp.range);
  const cutoff = rangeCutoffMs(range);

  // Pull a wide window so the date filter has data to chew on. The
  // file-store implementation already orders by createdAt DESC.
  const [allLogs, tours, leads] = await Promise.all([
    getAuditLogs({ limit: 1500 }),
    getTours(),
    getLeads(),
  ]);

  const tourById = new Map<string, Tour>(tours.map((t) => [t.id, t]));
  const leadById = new Map<string, Lead>(leads.map((l) => [l.id, l]));

  let messages: MessageRow[] = allLogs
    .map(toMessageRow)
    .filter((row): row is MessageRow => row !== null);

  // Apply the date-range cap first so KPI counts reflect the window the
  // admin is actually looking at. (Counting "Sent" against the last 7
  // days while the table shows last 30 would be confusing.)
  if (cutoff !== null) {
    messages = messages.filter((m) => new Date(m.createdAt).getTime() >= cutoff);
  }

  // Attach lead context (for resend buttons we need a leadId)
  messages = messages.map((row) => {
    if (!row.leadId && row.tourId) {
      const t = tourById.get(row.tourId);
      if (t) row.leadId = t.leadId;
    }
    return row;
  });

  const totalSent = messages.filter((m) => m.status === "sent").length;
  const totalFailed = messages.filter((m) => m.status === "failed").length;
  const totalSkipped = messages.filter((m) => m.status === "skipped").length;

  // Snapshot of failed messages BEFORE further filters so the bulk
  // retry button always operates on the full failed set in the current
  // date range — not just whatever sliver the admin is viewing.
  const failedInRange = messages.filter((m) => m.status === "failed");

  if (statusFilter !== "all") {
    messages = messages.filter((m) => m.status === statusFilter);
  }
  if (templateFilter !== "all") {
    messages = messages.filter((m) => m.template === templateFilter);
  }
  if (query) {
    messages = messages.filter(
      (m) =>
        m.recipient.toLowerCase().includes(query) ||
        m.summary.toLowerCase().includes(query) ||
        (m.supplierName ?? "").toLowerCase().includes(query)
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <Inbox className="h-6 w-6 text-[#12343b]" />
          Communications
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Every automated email sent to guests and suppliers — with status, recipient, and retry.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total messages"
          value={totalSent + totalFailed + totalSkipped}
          icon={Mail}
          tone="neutral"
        />
        <KpiCard label="Sent" value={totalSent} icon={CheckCircle2} tone="ok" />
        <KpiCard
          label="Failed"
          value={totalFailed}
          icon={AlertTriangle}
          tone="bad"
          action={
            failedInRange.length > 0 ? (
              <BulkRetryButton
                messages={failedInRange.map((m) => ({
                  id: m.id,
                  template: m.template,
                  invoiceId: m.invoiceId,
                  tourId: m.tourId,
                  leadId: m.leadId,
                  paymentId: m.paymentId,
                  recipient: m.recipient,
                  supplierName: m.supplierName,
                }))}
              />
            ) : null
          }
        />
        <KpiCard
          label="Skipped"
          value={totalSkipped}
          icon={CircleSlash}
          tone="warn"
        />
      </div>

      <CommunicationsFilters
        status={statusFilter}
        template={templateFilter}
        query={sp.q ?? ""}
        range={range}
      />

      <div className="paraiso-card overflow-hidden rounded-2xl">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Sparkles className="h-8 w-8 text-[#8a9ba1]" />
            <p className="text-sm text-[#5e7279]">
              No messages match the current filters. Scheduling a tour triggers guest +
              supplier emails and they will appear here.
            </p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd] text-left text-xs uppercase tracking-[0.1em] text-[#8a9ba1]">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Template</th>
                <th className="px-4 py-3 font-semibold">Recipient</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4dd]">
              {messages.map((m) => {
                const tour = m.tourId ? tourById.get(m.tourId) : null;
                const lead = m.leadId ? leadById.get(m.leadId) : null;
                return (
                  <tr key={m.id} className="align-top text-sm">
                    <td className="whitespace-nowrap px-4 py-3 text-[#5e7279]">
                      {new Date(m.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-[#11272b]">{m.templateLabel}</td>
                    <td className="px-4 py-3 text-[#5e7279]">
                      {m.recipient}
                      {m.supplierName && (
                        <div className="text-xs text-[#8a9ba1]">
                          {m.supplierName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#dce8dc] px-2.5 py-1 text-xs font-semibold text-[#375a3f]">
                          <CheckCircle2 className="h-3 w-3" />
                          Sent
                        </span>
                      ) : m.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#eed9cf] px-2.5 py-1 text-xs font-semibold text-[#7c3a24]">
                          <AlertTriangle className="h-3 w-3" />
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f3e8ce] px-2.5 py-1 text-xs font-semibold text-[#7a5a17]">
                          <AlertTriangle className="h-3 w-3" />
                          Skipped
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#11272b]">
                      <p>{m.summary}</p>
                      {m.error && (
                        <p className="mt-1 text-xs text-[#7c3a24]">Error: {m.error}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {m.invoiceId && (
                          <Link
                            href={`/admin/invoices/${m.invoiceId}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] px-2.5 py-1.5 text-xs font-medium text-[#12343b] transition hover:bg-[#f4ecdd]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Invoice
                          </Link>
                        )}
                        {m.tourId && (
                          <Link
                            href={`/admin/tours/${m.tourId}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] px-2.5 py-1.5 text-xs font-medium text-[#12343b] transition hover:bg-[#f4ecdd]"
                          >
                            Tour
                          </Link>
                        )}
                        {m.leadId && !m.tourId && (
                          <Link
                            href={`/admin/bookings/${m.leadId}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] px-2.5 py-1.5 text-xs font-medium text-[#12343b] transition hover:bg-[#f4ecdd]"
                          >
                            Booking
                          </Link>
                        )}
                        {m.paymentId && (
                          <Link
                            href={`/admin/payments/${m.paymentId}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] px-2.5 py-1.5 text-xs font-medium text-[#12343b] transition hover:bg-[#f4ecdd]"
                          >
                            Payment
                          </Link>
                        )}
                        <ResendEmailButton
                          message={{
                            template: m.template,
                            invoiceId: m.invoiceId,
                            tourId: m.tourId,
                            leadId: m.leadId ?? (tour?.leadId ?? lead?.id),
                            paymentId: m.paymentId,
                            recipient: m.recipient,
                            supplierName: m.supplierName,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  action,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "neutral" | "ok" | "bad" | "warn";
  action?: React.ReactNode;
}) {
  const colorMap = {
    neutral: { bg: "bg-[#eef4f4]", text: "text-[#12343b]" },
    ok: { bg: "bg-[#dce8dc]", text: "text-[#375a3f]" },
    bad: { bg: "bg-[#eed9cf]", text: "text-[#7c3a24]" },
    warn: { bg: "bg-[#f3e8ce]", text: "text-[#7a5a17]" },
  }[tone];
  return (
    <div className="paraiso-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap.bg} ${colorMap.text}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
              {label}
            </p>
            <p className="mt-0.5 text-2xl font-bold text-[#11272b]">{value}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
