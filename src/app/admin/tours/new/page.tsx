import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getLeads, getPackages } from "@/lib/db";
import { CreateTourForm } from "./CreateTourForm";

export default async function NewTourPage() {
  const [leads, packages] = await Promise.all([getLeads(), getPackages()]);

  const bookableLeads = leads.filter(
    (l) =>
      l.status === "won" ||
      l.status === "quoted" ||
      l.status === "negotiating" ||
      (l.source === "Client Portal" && l.packageId && l.status === "new")
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/calendar"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Schedule Tour</h1>
        <p className="mt-1 text-stone-600">
          Schedule a tour for a booking and add it to the calendar
        </p>
        <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-white/30" />}>
          <CreateTourForm leads={bookableLeads} packages={packages} />
        </Suspense>
      </div>
    </div>
  );
}
