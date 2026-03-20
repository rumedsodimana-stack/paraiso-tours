import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { getTourForClient } from "@/lib/db";
import { getClientPackageVisual, homeHeroScene } from "../../client-visuals";

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toLabel(value: string) {
  return value.replace(/_/g, " ").replace(/-/g, " ");
}

const statusColors: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-amber-100 text-amber-800",
  completed: "bg-stone-100 text-stone-700",
  cancelled: "bg-rose-100 text-rose-800",
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
};

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

  if ("pending" in result && result.pending) {
    const { lead, package: pkg } = result;
    const displayRef = lead.reference ?? ref;
    const visual = pkg ? getClientPackageVisual(pkg) : homeHeroScene;

    return (
      <div className="space-y-8 pb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 backdrop-blur-sm transition hover:text-[#12343b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to lookup
        </Link>

        <section
          className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_28px_70px_-34px_rgba(18,52,59,0.95)]"
          style={{
            backgroundImage: `linear-gradient(120deg, rgba(11,33,38,0.92) 10%, rgba(11,33,38,0.64) 48%, rgba(11,33,38,0.22) 100%), url(${visual.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-12">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.28em] text-[#e5c48e]">
                Booking request
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Awaiting team approval
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e5dccd] sm:text-base">
                Your request is in the queue. Once the admin team approves and
                schedules it, this page will turn into the live trip view.
              </p>

              <div className="mt-6 inline-flex rounded-[1.4rem] border border-white/12 bg-white/10 px-5 py-4 backdrop-blur-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#e5c48e]">
                    Reference
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-white">
                    {displayRef}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-6 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#e5c48e]">
                    Request status
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {pkg?.name ?? lead.destination ?? "Tour request"}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                  Pending
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {lead.travelDate ? (
                  <div className="rounded-[1.2rem] bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
                    Preferred date: {formatShortDate(lead.travelDate)}
                  </div>
                ) : null}
                {lead.pax ? (
                  <div className="rounded-[1.2rem] bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
                    Travellers: {lead.pax}
                  </div>
                ) : null}
                <div className="rounded-[1.2rem] bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
                  We&apos;ll notify you when this turns into a scheduled tour.
                </div>
              </div>
            </div>
          </div>
        </section>

        {pkg ? (
          <section className="rounded-[2rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
              Requested route
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
              {pkg.name}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              {pkg.description}
            </p>
          </section>
        ) : null}
      </div>
    );
  }

  if (!("tour" in result)) {
    redirect("/?error=notfound");
  }

  const { tour, package: pkg, invoice, payment } = result;
  const visual = getClientPackageVisual(pkg);

  return (
    <div className="space-y-8 pb-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 backdrop-blur-sm transition hover:text-[#12343b]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to lookup
      </Link>

      <section
        className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_28px_70px_-34px_rgba(18,52,59,0.95)]"
        style={{
          backgroundImage: `linear-gradient(120deg, rgba(11,33,38,0.92) 10%, rgba(11,33,38,0.64) 48%, rgba(11,33,38,0.22) 100%), url(${visual.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-12">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.28em] text-[#e5c48e]">
              Confirmed route
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              {tour.packageName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e5dccd] sm:text-base">
              Dear {tour.clientName}, your booking is now tied into the live
              operations records from the admin side.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  statusColors[tour.status] ?? "bg-stone-100 text-stone-700"
                }`}
              >
                {toLabel(tour.status)}
              </span>
              {invoice ? (
                <span
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    statusColors[invoice.status] ?? "bg-stone-100 text-stone-700"
                  }`}
                >
                  Invoice {toLabel(invoice.status)}
                </span>
              ) : null}
              {payment ? (
                <span
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    statusColors[payment.status] ?? "bg-stone-100 text-stone-700"
                  }`}
                >
                  Payment {toLabel(payment.status)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-6 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.24em] text-[#e5c48e]">
              Trip facts
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[1.2rem] bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
                Dates: {formatLongDate(tour.startDate)} to {formatLongDate(tour.endDate)}
              </div>
              <div className="rounded-[1.2rem] bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
                Travellers: {tour.pax}
              </div>
              <div className="rounded-[1.2rem] bg-white/10 px-4 py-3 text-sm text-[#ece1cf]">
                Reference: {ref}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.6rem] border border-[#ddc8b0] bg-white/72 p-5 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <MapPin className="h-5 w-5 text-[#12343b]" />
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">
            Destination
          </p>
          <p className="mt-2 font-semibold text-stone-900">{pkg.region ?? pkg.destination}</p>
        </div>
        <div className="rounded-[1.6rem] border border-[#ddc8b0] bg-white/72 p-5 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <Calendar className="h-5 w-5 text-[#12343b]" />
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">
            Travel dates
          </p>
          <p className="mt-2 font-semibold text-stone-900">
            {formatShortDate(tour.startDate)} to {formatShortDate(tour.endDate)}
          </p>
        </div>
        <div className="rounded-[1.6rem] border border-[#ddc8b0] bg-white/72 p-5 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <Users className="h-5 w-5 text-[#12343b]" />
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">
            Travellers
          </p>
          <p className="mt-2 font-semibold text-stone-900">{tour.pax} guests</p>
        </div>
        <div className="rounded-[1.6rem] border border-[#ddc8b0] bg-white/72 p-5 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <Clock3 className="h-5 w-5 text-[#12343b]" />
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">
            Tour status
          </p>
          <p className="mt-2 font-semibold capitalize text-stone-900">
            {toLabel(tour.status)}
          </p>
        </div>
      </section>

      {(invoice || payment) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {invoice ? (
            <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#12343b]" />
                <h2 className="text-lg font-semibold text-stone-900">
                  Invoice
                </h2>
              </div>
              <p className="mt-4 text-sm text-stone-600">
                Number: <span className="font-medium text-stone-900">{invoice.invoiceNumber}</span>
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Status: <span className="font-medium text-stone-900">{toLabel(invoice.status)}</span>
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Total: <span className="font-medium text-stone-900">{invoice.totalAmount.toLocaleString()} {invoice.currency}</span>
              </p>
            </div>
          ) : null}

          {payment ? (
            <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#12343b]" />
                <h2 className="text-lg font-semibold text-stone-900">
                  Payment
                </h2>
              </div>
              <p className="mt-4 text-sm text-stone-600">
                Status: <span className="font-medium text-stone-900">{toLabel(payment.status)}</span>
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Amount: <span className="font-medium text-stone-900">{payment.amount.toLocaleString()} {payment.currency}</span>
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Date: <span className="font-medium text-stone-900">{payment.date}</span>
              </p>
            </div>
          ) : null}
        </section>
      )}

      <section className="rounded-[2rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
          Itinerary
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
          Your trip flow
        </h2>
        <div className="mt-8 space-y-5">
          {pkg.itinerary.map((day) => (
            <div key={day.day} className="relative pl-12">
              <div className="absolute left-4 top-10 h-full w-px bg-[#ddc8b0]" />
              <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#12343b] text-sm font-semibold text-[#f6ead6]">
                {day.day}
              </div>
              <div className="rounded-[1.5rem] border border-[#eadfce] bg-[#fbf7f1] p-5">
                <h3 className="text-lg font-semibold text-stone-900">{day.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {day.description}
                </p>
                {day.accommodation && (
                  <p className="mt-3 text-sm font-medium text-[#12343b]">
                    Stay suggestion: {day.accommodation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <h3 className="flex items-center gap-2 font-semibold text-stone-900">
            <Check className="h-5 w-5 text-emerald-600" />
            Inclusions
          </h3>
          <ul className="mt-4 space-y-3">
            {pkg.inclusions.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-[1.2rem] bg-[#f8f3eb] px-4 py-3 text-sm text-stone-700"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <h3 className="flex items-center gap-2 font-semibold text-stone-900">
            <X className="h-5 w-5 text-stone-400" />
            Exclusions
          </h3>
          <ul className="mt-4 space-y-3">
            {pkg.exclusions.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-[1.2rem] bg-[#f8f3eb] px-4 py-3 text-sm text-stone-700"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 text-center shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
        <p className="font-medium text-stone-900">Questions about this tour?</p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Contact us at{" "}
          <a
            href="mailto:info@paraisoceylon.com"
            className="font-medium text-[#12343b] hover:underline"
          >
            info@paraisoceylon.com
          </a>
        </p>
      </div>
    </div>
  );
}
