import { getLeads, getPackages, getTours } from "@/lib/db";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LeadsTable } from "./LeadsTable";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; saved?: string; page?: string }> | { q?: string; saved?: string; page?: string };
}) {
  const [leads, packages, tours] = await Promise.all([getLeads(), getPackages(), getTours()]);
  const scheduledLeadIds = new Set(tours.map((t) => t.leadId));
  const unscheduledLeads = leads.filter((l) => !scheduledLeadIds.has(l.id));
  const packageNames: Record<string, string> = Object.fromEntries(
    packages.map((p) => [p.id, p.name])
  );
  const rawParams = searchParams ? await Promise.resolve(searchParams) : {};
  const params = rawParams as { q?: string; saved?: string; scheduled?: string; page?: string };
  const initialSearch = typeof params?.q === "string" ? params.q : undefined;
  const saved = params?.saved === "1";
  const scheduled = params?.scheduled === "1";

  const totalItems = unscheduledLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(totalPages, Number(params?.page) || 1));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedLeads = unscheduledLeads.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="space-y-6">
      {saved && <SaveSuccessBanner message="Booking saved successfully" />}
      {scheduled && <SaveSuccessBanner message="Tour scheduled successfully. The booking has been moved to the calendar." />}
      <LeadsTable
        key={initialSearch ?? "__empty__"}
        initialLeads={paginatedLeads}
        packageNames={packageNames}
        initialSearch={initialSearch}
      />

      {totalPages > 1 && (
        <div className="paraiso-card flex items-center justify-between rounded-2xl px-6 py-3">
          <p className="text-sm text-[#5e7279]">
            Showing {startIndex + 1}&ndash;{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems} bookings
          </p>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={`/admin/bookings?page=${currentPage - 1}${initialSearch ? `&q=${encodeURIComponent(initialSearch)}` : ""}`}
                className="inline-flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#faf6ef] px-3 py-2 text-sm font-medium text-[#8a9ba1] cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </span>
            )}
            <span className="px-2 text-sm font-medium text-[#5e7279]">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link
                href={`/admin/bookings?page=${currentPage + 1}${initialSearch ? `&q=${encodeURIComponent(initialSearch)}` : ""}`}
                className="inline-flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl border border-[#e0e4dd] bg-[#faf6ef] px-3 py-2 text-sm font-medium text-[#8a9ba1] cursor-not-allowed">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
