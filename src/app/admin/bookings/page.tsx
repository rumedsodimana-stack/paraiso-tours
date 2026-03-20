import { getLeads, getPackages, getTours } from "@/lib/db";
import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { LeadsTable } from "./LeadsTable";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; saved?: string }> | { q?: string; saved?: string };
}) {
  const [leads, packages, tours] = await Promise.all([getLeads(), getPackages(), getTours()]);
  const scheduledLeadIds = new Set(tours.map((t) => t.leadId));
  const unscheduledLeads = leads.filter((l) => !scheduledLeadIds.has(l.id));
  const packageNames: Record<string, string> = Object.fromEntries(
    packages.map((p) => [p.id, p.name])
  );
  const rawParams = searchParams ? await Promise.resolve(searchParams) : {};
  const params = rawParams as { q?: string; saved?: string; scheduled?: string };
  const initialSearch = typeof params?.q === "string" ? params.q : undefined;
  const saved = params?.saved === "1";
  const scheduled = params?.scheduled === "1";
  return (
    <div className="space-y-6">
      {saved && <SaveSuccessBanner message="Booking saved successfully" />}
      {scheduled && <SaveSuccessBanner message="Tour scheduled successfully. The booking has been moved to the calendar." />}
      <div className="rounded-[1.8rem] border border-white/20 bg-white/45 p-5 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                Booking AI
              </p>
              <h2 className="mt-1 text-lg font-semibold text-stone-900">
                Booking-level AI lives inside each booking record
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Open any booking to use the new booking copilot. It can generate
                a booking brief, answer booking-specific questions, and run one
                safe next action from the booking page itself.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/bookings/new"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-white"
            >
              Add a booking
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin/ai"
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              Open AI workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {unscheduledLeads.length === 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            There are no local bookings yet, so the booking-page AI will not show until you create one.
          </div>
        ) : null}
      </div>
      <LeadsTable
        key={initialSearch ?? "__empty__"}
        initialLeads={unscheduledLeads}
        packageNames={packageNames}
        initialSearch={initialSearch}
      />
    </div>
  );
}
