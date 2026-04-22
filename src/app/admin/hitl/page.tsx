import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getAiInteractions, getLeads, getTours } from "@/lib/db";
import type { Lead } from "@/lib/types";
import { HitlBookingRowActions } from "./HitlBookingRowActions";

export const dynamic = "force-dynamic";

const REVIEWABLE_STATUSES: Lead["status"][] = ["new"];

function shortenText(text: string, max = 140) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function timeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

export default async function HitlPage() {
  const [leads, tours, interactions] = await Promise.all([
    getLeads(),
    getTours(),
    getAiInteractions(30),
  ]);

  const scheduledLeadIds = new Set(tours.map((t) => t.leadId));
  const awaitingApproval = leads
    .filter(
      (l) =>
        REVIEWABLE_STATUSES.includes(l.status) && !scheduledLeadIds.has(l.id)
    )
    .sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
    );

  const aiProposals = interactions
    .filter((i) => {
      const tool = i.tool || "";
      return (
        tool === "client_concierge" ||
        tool === "journey_assistant" ||
        tool === "booking_brief" ||
        tool === "workspace_copilot"
      );
    })
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <ShieldCheck className="h-6 w-6 text-[#12343b]" />
          Human approval queue
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Every agent action and every client-portal booking waits for your sign-off here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Bookings awaiting review"
          value={awaitingApproval.length}
          icon={Users}
          tone={awaitingApproval.length > 0 ? "warn" : "ok"}
        />
        <KpiCard
          label="AI proposals (recent)"
          value={aiProposals.length}
          icon={Bot}
          tone="info"
        />
        <KpiCard
          label="Active tours"
          value={tours.filter((t) => t.status === "scheduled" || t.status === "confirmed").length}
          icon={CheckCircle2}
          tone="ok"
        />
      </div>

      {/* Bookings queue */}
      <section className="paraiso-card rounded-2xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#11272b]">
          <Users className="h-5 w-5 text-[#12343b]" />
          Bookings awaiting admin approval
        </h2>
        {awaitingApproval.length === 0 ? (
          <p className="text-sm text-[#5e7279]">
            Nothing waiting — every booking has been reviewed.
          </p>
        ) : (
          <ul className="divide-y divide-[#e0e4dd]">
            {awaitingApproval.slice(0, 20).map((lead) => (
              <li key={lead.id} className="flex items-start justify-between gap-4 py-3 px-3 -mx-3">
                <Link
                  href={`/admin/bookings/${lead.id}`}
                  className="min-w-0 flex-1 transition rounded-xl hover:bg-[#f4ecdd] -mx-2 px-2 py-1"
                >
                  <p className="font-medium text-[#11272b]">{lead.name}</p>
                  <p className="mt-0.5 text-xs text-[#5e7279]">
                    {lead.email}
                    {lead.travelDate && ` · travel ${lead.travelDate}`}
                    {lead.pax != null && ` · ${lead.pax} pax`}
                  </p>
                  {lead.notes && (
                    <p className="mt-1 text-xs text-[#8a9ba1]">
                      {shortenText(lead.notes)}
                    </p>
                  )}
                </Link>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        lead.status === "new"
                          ? "bg-[#f3e8ce] text-[#7a5a17]"
                          : lead.status === "cancelled"
                            ? "bg-[#eed9cf] text-[#7c3a24]"
                            : "bg-[#eef4f4] text-[#12343b]"
                      }`}
                    >
                      {lead.status}
                    </span>
                    <span className="text-xs text-[#8a9ba1]">
                      <Clock className="inline h-3 w-3 mr-0.5" />
                      {timeAgo(lead.updatedAt || lead.createdAt)}
                    </span>
                  </div>
                  <HitlBookingRowActions leadId={lead.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* AI proposals */}
      <section className="paraiso-card rounded-2xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#11272b]">
          <Bot className="h-5 w-5 text-[#12343b]" />
          Recent AI proposals
        </h2>
        {aiProposals.length === 0 ? (
          <p className="text-sm text-[#5e7279]">
            No AI proposals yet. When guests or staff use the AI tools, their
            requests and drafts will appear here for review.
          </p>
        ) : (
          <ul className="space-y-3">
            {aiProposals.map((interaction) => (
              <li
                key={interaction.id}
                className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4f4] px-2.5 py-1 text-xs font-semibold text-[#12343b]">
                    <Bot className="h-3 w-3" />
                    {interaction.tool}
                  </span>
                  <span className="text-xs text-[#8a9ba1]">
                    <Clock className="inline h-3 w-3 mr-0.5" />
                    {timeAgo(interaction.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-[#11272b]">
                  {shortenText(interaction.requestText ?? "")}
                </p>
                <p className="mt-1 text-xs text-[#5e7279]">
                  {shortenText(interaction.responseText ?? "", 180)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 rounded-xl border border-dashed border-[#e0e4dd] bg-[#faf6ef] px-4 py-3 text-xs text-[#5e7279]">
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1 text-[#c9922f]" />
          AI proposals are logged automatically. Acting on them (scheduling a
          tour, sending an email, creating an invoice) is always a separate
          explicit action — the AI never commits these on its own.
        </div>
      </section>
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
  tone: "ok" | "warn" | "info";
}) {
  const map = {
    ok: { bg: "bg-[#dce8dc]", text: "text-[#375a3f]" },
    warn: { bg: "bg-[#f3e8ce]", text: "text-[#7a5a17]" },
    info: { bg: "bg-[#eef4f4]", text: "text-[#12343b]" },
  }[tone];
  return (
    <div className="paraiso-card rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${map.bg} ${map.text}`}>
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
