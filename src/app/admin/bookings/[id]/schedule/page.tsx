import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Users, MapPin } from "lucide-react";
import { getLead, getPackage } from "@/lib/db";
import { ScheduleTourButton } from "./ScheduleTourButton";

export default async function BookingSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const pkg = lead.packageId ? await getPackage(lead.packageId) : null;
  if (!pkg) {
    return (
      <div className="space-y-6">
        <Link
          href={`/admin/bookings/${id}`}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to booking
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-medium">No package selected</p>
          <p className="mt-1 text-sm">
            <Link href={`/admin/bookings/${id}/edit`} className="underline hover:no-underline">
              Edit the booking
            </Link>{" "}
            to select a package before scheduling.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/bookings/${id}`}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to booking
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Schedule Tour</h1>
        <p className="mt-1 text-stone-600">
          Schedule this booking on the calendar using the details below.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-stone-500">Client</p>
            <p className="mt-0.5 font-medium text-stone-900">{lead.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Package</p>
            <p className="mt-0.5 flex items-center gap-2 text-stone-900">
              <MapPin className="h-4 w-4 text-teal-600" />
              {pkg.name}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Travelers</p>
            <p className="mt-0.5 flex items-center gap-2 text-stone-900">
              <Users className="h-4 w-4 text-teal-600" />
              {lead.pax ?? 1} pax
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Start date</p>
            <p className="mt-0.5 flex items-center gap-2 text-stone-900">
              <Calendar className="h-4 w-4 text-teal-600" />
              {lead.travelDate
                ? new Date(lead.travelDate).toLocaleDateString("en-GB", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Not set"}
            </p>
          </div>
        </div>
        <div className="mt-8 space-y-4">
          <p className="text-sm text-stone-500">
            Scheduling also checks supplier capacity and missing supplier links.
            If attention is needed, you will be taken to the tour detail page
            with warnings.
          </p>
          <ScheduleTourButton
            leadId={lead.id}
            hasTravelDate={!!lead.travelDate}
          />
        </div>
      </div>
    </div>
  );
}
