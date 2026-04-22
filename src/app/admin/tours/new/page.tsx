import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getLeads, getPackages } from "@/lib/db";
import { CreateTourForm } from "./CreateTourForm";

export default async function NewTourPage() {
  const [leads, packages] = await Promise.all([getLeads(), getPackages()]);

  // Any booking that isn't cancelled is bookable (new or already scheduled
  // — re-scheduling is supported and just updates the tour).
  const bookableLeads = leads.filter(
    (l) => l.status !== "cancelled" && l.status !== "completed"
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/calendar"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-[#11272b]">Schedule Tour</h1>
        <p className="mt-1 text-[#5e7279]">
          Schedule a tour for a booking and add it to the calendar
        </p>
        <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-[#f4ecdd]" />}>
          <CreateTourForm leads={bookableLeads} packages={packages} />
        </Suspense>
      </div>
    </div>
  );
}
