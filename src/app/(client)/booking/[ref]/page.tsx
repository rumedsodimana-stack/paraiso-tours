import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Calendar, Users, Check, X, ChevronRight } from "lucide-react";
import { getTourForClient } from "@/lib/db";

export default async function ClientBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { ref } = await params;
  const { email } = await searchParams;

  const result = await getTourForClient(ref, email ?? undefined);
  if (!result) {
    redirect("/?error=notfound");
  }

  // Pending request – show status until service provider approves
  if ("pending" in result && result.pending) {
    const { lead, package: pkg } = result;
    const displayRef = lead.reference ?? ref;
    return (
      <div className="space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
          >
            ← Back to lookup
          </Link>
        </div>
        <div className="rounded-2xl border border-white/50 bg-white/70 p-8 shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-stone-500">Booking reference {displayRef}</p>
              <h1 className="mt-1 text-2xl font-bold text-stone-900">
                {pkg?.name ?? lead.destination ?? "Tour request"}
              </h1>
              <p className="mt-2 text-stone-600">Dear {lead.name},</p>
            </div>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800">
              Pending approval
            </span>
          </div>
          <p className="mt-6 text-stone-600">
            Your booking request has been received and is awaiting approval from our team.
            We&apos;ll send you a confirmation and full itinerary once your tour has been approved.
          </p>
          {pkg && (
            <div className="mt-6 rounded-xl border border-stone-100 bg-white/50 p-4">
              <h3 className="font-medium text-stone-900">{pkg.name}</h3>
              <p className="mt-1 text-sm text-stone-600">{pkg.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { tour, package: pkg } = result as { tour: import("@/lib/types").Tour; package: import("@/lib/types").TourPackage };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const statusColors: Record<string, string> = {
    scheduled: "bg-sky-100 text-sky-800",
    confirmed: "bg-emerald-100 text-emerald-800",
    "in-progress": "bg-amber-100 text-amber-800",
    completed: "bg-stone-100 text-stone-600",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
        >
          ← Back to lookup
        </Link>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/70 p-8 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-stone-500">Booking {ref}</p>
            <h1 className="mt-1 text-2xl font-bold text-stone-900">
              {tour.packageName}
            </h1>
            <p className="mt-2 text-stone-600">Dear {tour.clientName},</p>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-medium ${statusColors[tour.status] ?? "bg-stone-100 text-stone-600"}`}
          >
            {tour.status.replace("-", " ")}
          </span>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-teal-50/80 p-4">
            <MapPin className="h-5 w-5 text-teal-600" />
            <div>
              <p className="text-xs text-stone-500">Destination</p>
              <p className="font-medium text-stone-900">Sri Lanka</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-amber-50/80 p-4">
            <Calendar className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-xs text-stone-500">Dates</p>
              <p className="font-medium text-stone-900">
                {formatDate(tour.startDate)} – {formatDate(tour.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-sky-50/80 p-4">
            <Users className="h-5 w-5 text-sky-600" />
            <div>
              <p className="text-xs text-stone-500">Travelers</p>
              <p className="font-medium text-stone-900">{tour.pax} guests</p>
            </div>
          </div>
        </div>
      </div>

      {pkg && (
        <>
          <div className="rounded-2xl border border-white/50 bg-white/70 p-8 shadow-xl backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-stone-900">Your Itinerary</h2>
            <p className="mt-1 text-sm text-stone-600">{pkg.description}</p>
            <div className="mt-6 space-y-4">
              {pkg.itinerary.map((day) => (
                <div
                  key={day.day}
                  className="flex gap-4 rounded-xl border border-stone-100 bg-white/50 p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                    {day.day}
                  </span>
                  <div>
                    <h3 className="font-medium text-stone-900">{day.title}</h3>
                    <p className="mt-1 text-sm text-stone-600">{day.description}</p>
                    {day.accommodation && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Hotel: {day.accommodation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
              <h3 className="flex items-center gap-2 font-semibold text-stone-900">
                <Check className="h-5 w-5 text-emerald-500" />
                Inclusions
              </h3>
              <ul className="mt-3 space-y-2">
                {pkg.inclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
              <h3 className="flex items-center gap-2 font-semibold text-stone-900">
                <X className="h-5 w-5 text-stone-400" />
                Exclusions
              </h3>
              <ul className="mt-3 space-y-2">
                {pkg.exclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <div className="rounded-2xl border border-teal-200/50 bg-teal-50/50 p-6 text-center">
        <p className="font-medium text-stone-800">Questions about your tour?</p>
        <p className="mt-1 text-sm text-stone-600">
          Contact us at{" "}
          <a href="mailto:info@paraisoceylon.com" className="text-teal-600 hover:underline">
            info@paraisoceylon.com
          </a>
        </p>
      </div>
    </div>
  );
}
