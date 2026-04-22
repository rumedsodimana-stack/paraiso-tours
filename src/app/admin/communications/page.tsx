import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Inbox,
  Mail,
  Sparkles,
} from "lucide-react";
import { getAuditLogs, getLeads, getTours } from "@/lib/db";
import type { AuditLog, Lead, Tour } from "@/lib/types";
import { CommunicationsFilters } from "./CommunicationsFilters";
import { ResendEmailButton } from "./ResendEmailButton";

export const dynamic = "force-dynamic";

type MessageStatus = "sent" | "failed" | "skipped";
type MessageTemplate =
  | "tour_confirmation_with_invoice"
  | "supplier_reservation"
  | "payment_receipt"
  | "invoice"
  | "itinerary"
  | "other";

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
  supplierName?: string;
}

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
]);

function templateFromMetadata(meta: Record<string, unknown> | undefined): MessageTemplate {
  const t = meta?.template;
  if (typeof t !== "string") return "other";
  if (t === "tour_confirmation_with_invoice") return t;
  if (t === "supplier_reservation") return t;
  if (t === "payment_receipt") return t;
  if (t === "invoice") return t;
  if (t === "itinerary") return t;
  return "other";
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
    default:
      return "Other";
  }
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
  }
  return row;
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; template?: string; q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const statusFilter = sp.status === "failed" ? "failed" : sp.status === "sent" ? "sent" : "all";
  const templateFilter = sp.template ?? "all";
  const query = (sp.q ?? "").trim().toLowerCase();

  const [allLogs, tours, leads] = await Promise.all([
    getAuditLogs({ limit: 500 }),
    getTours(),
    getLeads(),
  ]);

  const tourById = new Map<string, Tour>(tours.map((t) => [t.id, t]));
  const leadById = new Map<string, Lead>(leads.map((l) => [l.id, l]));

  let messages: MessageRow[] = allLogs
    .map(toMessageRow)
    .filter((row): row is MessageRow => row !== null);

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

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total messages"
          value={totalSent + totalFailed}
          icon={Mail}
          tone="neutral"
        />
        <KpiCard label="Sent" value={totalSent} icon={CheckCircle2} tone="ok" />
        <KpiCard label="Failed" value={totalFailed} icon={AlertTriangle} tone="bad" />
      </div>

      <CommunicationsFilters
        status={statusFilter}
        template={templateFilter}
        query={sp.q ?? ""}
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
                        <ResendEmailButton
                          message={{
                            template: m.template,
                            invoiceId: m.invoiceId,
                            tourId: m.tourId,
                            leadId: m.leadId ?? (tour?.leadId ?? lead?.id),
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
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "neutral" | "ok" | "bad";
}) {
  const colorMap = {
    neutral: { bg: "bg-[#eef4f4]", text: "text-[#12343b]" },
    ok: { bg: "bg-[#dce8dc]", text: "text-[#375a3f]" },
    bad: { bg: "bg-[#eed9cf]", text: "text-[#7c3a24]" },
  }[tone];
  return (
    <div className="paraiso-card rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap.bg} ${colorMap.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-[#11272b]">{value}</p>
        </div>
      </div>
    </div>
  );
}
