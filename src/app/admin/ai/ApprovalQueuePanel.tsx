import Link from "next/link";
import { Clock, ShieldCheck, Users } from "lucide-react";
import { getLeads, getTours } from "@/lib/db";
import type { Lead } from "@/lib/types";
import { HitlBookingRowActions } from "@/app/admin/hitl/HitlBookingRowActions";

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

/**
 * Bookings-awaiting-approval panel.
 *
 * Lives below the chat on /admin/ai so the admin can clear the queue
 * without leaving the AI surface. Agent-originated action proposals do
 * NOT show up here — those render inline in the chat itself, gated by
 * `<AgentProposals />`. This panel is strictly for client-portal /
 * inbound bookings (status="new") that need a human sign-off.
 */
export async function ApprovalQueuePanel() {
  const [leads, tours] = await Promise.all([getLeads(), getTours()]);

  const scheduledLeadIds = new Set(tours.map((t) => t.leadId));
  const awaitingApproval = leads
    .filter(
      (l) =>
        REVIEWABLE_STATUSES.includes(l.status) && !scheduledLeadIds.has(l.id)
    )
    .sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
    );

  return (
    <section className="paraiso-card rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#12343b]" />
        <h2 className="text-lg font-semibold text-[#11272b]">
          Pending approvals
        </h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#f3e8ce] px-2.5 py-1 text-xs font-semibold text-[#7a5a17]">
          <Users className="h-3 w-3" />
          {awaitingApproval.length} awaiting
        </span>
      </div>
      <p className="-mt-2 mb-4 text-xs text-[#8a9ba1]">
        Inbound bookings waiting for you to confirm or reject.
      </p>

      {awaitingApproval.length === 0 ? (
        <p className="text-sm text-[#5e7279]">
          Nothing waiting — every booking has been reviewed.
        </p>
      ) : (
        <ul className="divide-y divide-[#e0e4dd]">
          {awaitingApproval.slice(0, 20).map((lead) => (
            <li
              key={lead.id}
              className="-mx-3 flex items-start justify-between gap-4 px-3 py-3"
            >
              <Link
                href={`/admin/bookings/${lead.id}`}
                className="-mx-2 min-w-0 flex-1 rounded-xl px-2 py-1 transition hover:bg-[#f4ecdd]"
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
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#f3e8ce] px-2.5 py-1 text-xs font-semibold text-[#7a5a17]">
                    {lead.status}
                  </span>
                  <span className="text-xs text-[#8a9ba1]">
                    <Clock className="mr-0.5 inline h-3 w-3" />
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
  );
}
