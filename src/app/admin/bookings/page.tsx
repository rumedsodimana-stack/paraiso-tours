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
      <LeadsTable
        key={initialSearch ?? "__empty__"}
        initialLeads={unscheduledLeads}
        packageNames={packageNames}
        initialSearch={initialSearch}
      />
    </div>
  );
}
