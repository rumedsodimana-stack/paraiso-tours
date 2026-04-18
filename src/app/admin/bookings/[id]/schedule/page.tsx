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
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
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
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to booking
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-[#11272b]">Schedule Tour</h1>
        <p className="mt-1 text-[#5e7279]">
          Schedule this booking on the calendar using the details below.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-[#5e7279]">Client</p>
            <p className="mt-0.5 font-medium text-[#11272b]">{lead.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-[#5e7279]">Package</p>
            <p className="mt-0.5 flex items-center gap-2 text-[#11272b]">
              <MapPin className="h-4 w-4 text-[#12343b]" />
              {pkg.name}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[#5e7279]">Travelers</p>
            <p className="mt-0.5 flex items-center gap-2 text-[#11272b]">
              <Users className="h-4 w-4 text-[#12343b]" />
              {lead.pax ?? 1} pax
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[#5e7279]">Start date</p>
            <p className="mt-0.5 flex items-center gap-2 text-[#11272b]">
              <Calendar className="h-4 w-4 text-[#12343b]" />
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
          <p className="text-sm text-[#5e7279]">
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
