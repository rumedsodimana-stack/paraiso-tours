import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CreditCard,
  FileText,
  X,
} from "lucide-react";
import { getTourForClient } from "@/lib/db";
import { getAuditLogsForEntities } from "@/lib/audit";
import { getClientPackageVisual, homeHeroScene } from "../../client-visuals";
import { BookingShareActions } from "./BookingShareActions";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import {
  ContentCard,
  HeroBand,
  PillRow,
  PortalShell,
  SectionHeader,
  StatRow,
  type StatItem,
} from "../../_ui";

/**
 * Client booking detail.
 *
 * Two shapes come in from getTourForClient:
 *   - "pending" (lead before the admin team schedules it) — carries
 *     optional route-builder metadata if the client built a custom
 *     route. We read that metadata from the audit log and render the
 *     full stop-by-stop breakdown.
 *   - Confirmed tour — full live itinerary plus invoice + payment.
 *
 * Both branches render on the editorial shell: HeroBand + StatRow +
 * paper ContentCards. Print layout is kept intact at the top of each
 * branch so the invoice-adjacent view prints cleanly.
 */

type CustomRouteStopMeta = {
  destinationId?: string;
  destinationName?: string;
  nights?: number;
  hotelName?: string;
  hotelRate?: number;
  hotelCurrency?: string;
  activities?: string[];
  legDistanceKm?: number;
  legDriveHours?: number;
};

type CustomRouteMeta = {
  routeStops?: CustomRouteStopMeta[];
  transportLabel?: string;
  mealLabel?: string;
  mealRequest?: string;
  stayStyle?: string;
  accommodationMode?: string;
  guidanceFee?: number;
  guidanceLabel?: string;
  desiredNights?: number;
};

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

function getBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function readCustomRouteMeta(
  metadata?: Record<string, unknown>
): CustomRouteMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const routeStops = Array.isArray(metadata.routeStops)
    ? (metadata.routeStops as CustomRouteStopMeta[])
    : [];
  if (routeStops.length === 0) return null;
  return {
    routeStops,
    transportLabel:
      typeof metadata.transportLabel === "string"
        ? metadata.transportLabel
        : undefined,
    mealLabel:
      typeof metadata.mealLabel === "string" ? metadata.mealLabel : undefined,
    mealRequest:
      typeof metadata.mealRequest === "string"
        ? metadata.mealRequest
        : undefined,
    stayStyle:
      typeof metadata.stayStyle === "string" ? metadata.stayStyle : undefined,
    accommodationMode:
      typeof metadata.accommodationMode === "string"
        ? metadata.accommodationMode
        : undefined,
    guidanceFee:
      typeof metadata.guidanceFee === "number"
        ? metadata.guidanceFee
        : undefined,
    guidanceLabel:
      typeof metadata.guidanceLabel === "string"
        ? metadata.guidanceLabel
        : undefined,
    desiredNights:
      typeof metadata.desiredNights === "number"
        ? metadata.desiredNights
        : undefined,
  };
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

function BackBar({
  emailHref,
  whatsappHref,
}: {
  emailHref: string;
  whatsappHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-[var(--portal-ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to lookup
      </Link>
      <BookingShareActions
        emailHref={emailHref}
        whatsappHref={whatsappHref}
      />
    </div>
  );
}

export default async function ClientBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { ref } = await params;
  const { email } = await searchParams;
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);

  const result = await getTourForClient(ref, email ?? undefined);
  if (!result) {
    redirect("/?error=notfound");
  }

  /* ─── Pending branch ─────────────────────────────────────────────── */
  if ("pending" in result && result.pending) {
    const { lead, package: pkg } = result;
    const displayRef = lead.reference ?? ref;
    const visual = pkg ? getClientPackageVisual(pkg) : homeHeroScene;
    const bookingLink = `${getBaseUrl()}/booking/${encodeURIComponent(
      displayRef
    )}${email ? `?email=${encodeURIComponent(email)}` : ""}`;
    const shareSubject = encodeURIComponent(
      `My Sri Lanka booking ${displayRef}`
    );
    const shareBody = encodeURIComponent(
      `Here is my Sri Lanka booking itinerary.\n\nReference: ${displayRef}\nLink: ${bookingLink}`
    );

    const routeLogs = await getAuditLogsForEntities(
      [{ entityType: "lead", entityId: lead.id }],
      20
    );
    const routeMetadata =
      routeLogs.find((log) => log.action === "created_from_route_builder")
        ?.metadata ?? undefined;
    const customRoute = readCustomRouteMeta(routeMetadata);

    const pendingStats: StatItem[] = [
      {
        label: "Reference",
        value: (
          <span className="font-mono text-base sm:text-lg">{displayRef}</span>
        ),
      },
      {
        label: "Preferred start",
        value: lead.travelDate ? formatShortDate(lead.travelDate) : "TBD",
      },
      {
        label: "Travellers",
        value: `${lead.pax ?? 1} guest${(lead.pax ?? 1) === 1 ? "" : "s"}`,
      },
    ];

    return (
      <PortalShell spacing="tight" className="pb-10">
        {/* Print-only header (unchanged) */}
        <section className="hidden rounded-[1.5rem] border border-stone-200 bg-white px-6 py-6 print:block">
          <p className="text-sm font-semibold text-stone-900">{brandName}</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">
            Booking itinerary
          </h1>
          <div className="mt-4 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
            <p>Reference: {displayRef}</p>
            <p>Client: {lead.name}</p>
            <p>
              Preferred start:{" "}
              {lead.travelDate ? formatShortDate(lead.travelDate) : "TBD"}
            </p>
            <p>Travellers: {lead.pax ?? 1}</p>
          </div>
        </section>

        <BackBar
          emailHref={`mailto:?subject=${shareSubject}&body=${shareBody}`}
          whatsappHref={`https://wa.me/?text=${shareBody}`}
        />

        <div className="print:hidden">
          <HeroBand
            imageUrl={visual.imageUrl}
            imageAlt={pkg?.name ?? "Booking request"}
            asideChildren={
              <>
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-gold)]">
                  Status
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                  Pending approval
                </div>
                <p className="text-sm leading-6 text-[var(--portal-sand-warm)]">
                  We&apos;ll notify you once the admin team schedules this
                  request — this page will then turn into the live trip view.
                </p>
              </>
            }
          >
            <HeroBand.Eyebrow>Booking request</HeroBand.Eyebrow>
            <HeroBand.Title>
              {pkg?.name ?? lead.destination ?? "Awaiting team approval"}
            </HeroBand.Title>
            <HeroBand.Summary>
              Your request is in the queue. Once the admin team approves and
              schedules it, the itinerary below turns into a live trip.
            </HeroBand.Summary>
          </HeroBand>
        </div>

        <StatRow tone="light" stats={pendingStats} />

        {customRoute ? (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <ContentCard variant="paper">
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
                  Stay style
                </p>
                <p className="portal-display mt-2 text-lg font-semibold text-stone-900">
                  {customRoute.stayStyle ?? "Custom request"}
                </p>
              </ContentCard>
              <ContentCard variant="paper">
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
                  Transport
                </p>
                <p className="portal-display mt-2 text-lg font-semibold text-stone-900">
                  {customRoute.transportLabel ?? "Not selected"}
                </p>
              </ContentCard>
              <ContentCard variant="paper">
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
                  Meals
                </p>
                <p className="portal-display mt-2 text-lg font-semibold text-stone-900">
                  {customRoute.mealLabel ?? "No meal plan"}
                </p>
              </ContentCard>
            </section>

            <ContentCard variant="paper" as="section">
              <SectionHeader
                eyebrow="Full itinerary breakdown"
                title="Your planned journey"
                align="stack"
              />
              <ol className="mt-8 space-y-5">
                {customRoute.routeStops?.map((stop, index) => {
                  const isLast =
                    index === (customRoute.routeStops?.length ?? 0) - 1;
                  return (
                    <li
                      key={`${stop.destinationName}_${index}`}
                      className="relative pl-14"
                    >
                      {!isLast ? (
                        <span className="absolute left-5 top-10 h-full w-px bg-[var(--portal-border)]" />
                      ) : null}
                      <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-ink)] text-sm font-semibold text-[var(--portal-cream)]">
                        {index + 1}
                      </span>
                      <div className="rounded-[var(--portal-radius-md)] border border-[var(--portal-border)]/60 bg-white/80 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="portal-display text-lg font-semibold tracking-tight text-stone-900">
                              {stop.destinationName ?? "Destination"}
                            </h3>
                            <p className="mt-1 text-sm text-stone-500">
                              {stop.nights ?? 1} night
                              {stop.nights === 1 ? "" : "s"}
                            </p>
                          </div>
                          {stop.legDistanceKm != null ||
                          stop.legDriveHours != null ? (
                            <div className="rounded-full border border-[var(--portal-border)] bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-600">
                              Transfer in: {stop.legDistanceKm ?? 0} km ·{" "}
                              {stop.legDriveHours != null
                                ? `${stop.legDriveHours.toFixed(1)} h`
                                : "TBD"}
                            </div>
                          ) : null}
                        </div>
                        {stop.hotelName ? (
                          <p className="mt-4 text-sm font-medium text-[var(--portal-ink)]">
                            Stay · {stop.hotelName}
                            {stop.hotelRate != null
                              ? ` (${stop.hotelRate.toLocaleString()} ${
                                  stop.hotelCurrency ?? "USD"
                                } / night)`
                              : ""}
                          </p>
                        ) : null}
                        {Array.isArray(stop.activities) &&
                        stop.activities.length > 0 ? (
                          <div className="mt-4">
                            <PillRow
                              items={stop.activities}
                              tone="light"
                              size="sm"
                            />
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ContentCard>

            {customRoute.mealRequest ? (
              <ContentCard variant="paper">
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-eyebrow)]">
                  Meal request
                </p>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {customRoute.mealRequest}
                </p>
              </ContentCard>
            ) : null}
          </>
        ) : pkg ? (
          <ContentCard variant="paper" as="section">
            <SectionHeader
              eyebrow="Requested route"
              title={pkg.name}
              align="stack"
              description={pkg.description}
            />
          </ContentCard>
        ) : null}
      </PortalShell>
    );
  }

  /* ─── Confirmed tour branch ──────────────────────────────────────── */
  if (!("tour" in result)) {
    redirect("/?error=notfound");
  }

  const { tour, package: pkg, invoice, payment } = result;
  const visual = getClientPackageVisual(pkg);
  const bookingLink = `${getBaseUrl()}/booking/${encodeURIComponent(ref)}${
    email ? `?email=${encodeURIComponent(email)}` : ""
  }`;
  const invoiceLink = `/booking/${encodeURIComponent(ref)}/invoice${
    email ? `?email=${encodeURIComponent(email)}` : ""
  }`;
  const shareSubject = encodeURIComponent(`My Sri Lanka itinerary ${ref}`);
  const shareBody = encodeURIComponent(
    `Here is my Sri Lanka itinerary.\n\nReference: ${ref}\nLink: ${bookingLink}`
  );

  const tourStats: StatItem[] = [
    {
      label: "Destination",
      value: pkg.region ?? pkg.destination,
    },
    {
      label: "Travel dates",
      value: `${formatShortDate(tour.startDate)} → ${formatShortDate(
        tour.endDate
      )}`,
    },
    {
      label: "Travellers",
      value: `${tour.pax} guest${tour.pax === 1 ? "" : "s"}`,
    },
    {
      label: "Status",
      value: toLabel(tour.status),
    },
  ];

  return (
    <PortalShell spacing="tight" className="pb-10">
      {/* Print-only header (unchanged) */}
      <section className="hidden rounded-[1.5rem] border border-stone-200 bg-white px-6 py-6 print:block">
        <p className="text-sm font-semibold text-stone-900">{brandName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          Travel itinerary
        </h1>
        <div className="mt-4 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
          <p>Reference: {ref}</p>
          <p>Client: {tour.clientName}</p>
          <p>
            Travel dates: {formatShortDate(tour.startDate)} to{" "}
            {formatShortDate(tour.endDate)}
          </p>
          <p>Travellers: {tour.pax}</p>
        </div>
      </section>

      <BackBar
        emailHref={`mailto:?subject=${shareSubject}&body=${shareBody}`}
        whatsappHref={`https://wa.me/?text=${shareBody}`}
      />

      <div className="print:hidden">
        <HeroBand
          imageUrl={visual.imageUrl}
          imageAlt={tour.packageName}
          asideChildren={
            <>
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--portal-gold)]">
                Trip facts
              </p>
              <div className="space-y-2 text-sm text-[var(--portal-sand-warm)]">
                <p className="rounded-[var(--portal-radius-md)] border border-white/14 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  Dates: {formatLongDate(tour.startDate)} —{" "}
                  {formatLongDate(tour.endDate)}
                </p>
                <p className="rounded-[var(--portal-radius-md)] border border-white/14 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  Travellers: {tour.pax}
                </p>
                <p className="rounded-[var(--portal-radius-md)] border border-white/14 bg-white/10 px-4 py-3 font-mono backdrop-blur-sm">
                  Reference: {ref}
                </p>
              </div>
            </>
          }
        >
          <HeroBand.Eyebrow>Confirmed route</HeroBand.Eyebrow>
          <HeroBand.Title>{tour.packageName}</HeroBand.Title>
          <HeroBand.Summary>
            Dear {tour.clientName}, your booking is now tied into the live
            operations records from the admin side.
          </HeroBand.Summary>
          <div className="mt-6 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                statusColors[tour.status] ?? "bg-stone-100 text-stone-700"
              }`}
            >
              {toLabel(tour.status)}
            </span>
            {invoice ? (
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                  statusColors[invoice.status] ?? "bg-stone-100 text-stone-700"
                }`}
              >
                Invoice {toLabel(invoice.status)}
              </span>
            ) : null}
            {payment ? (
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                  statusColors[payment.status] ?? "bg-stone-100 text-stone-700"
                }`}
              >
                Payment {toLabel(payment.status)}
              </span>
            ) : null}
          </div>
        </HeroBand>
      </div>

      <StatRow tone="light" stats={tourStats} />

      {invoice || payment ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {invoice ? (
            <ContentCard variant="paper">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--portal-ink)]" />
                <h3 className="portal-display text-lg font-semibold text-stone-900">
                  Invoice
                </h3>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Number</dt>
                  <dd className="font-medium text-stone-900">
                    {invoice.invoiceNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Status</dt>
                  <dd className="font-medium text-stone-900">
                    {toLabel(invoice.status)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Total</dt>
                  <dd className="portal-display font-semibold text-stone-900">
                    {invoice.totalAmount.toLocaleString()} {invoice.currency}
                  </dd>
                </div>
              </dl>
              <Link
                href={invoiceLink}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-white/80 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-[var(--portal-ink)] hover:text-[var(--portal-ink)]"
              >
                <FileText className="h-4 w-4" />
                View invoice
              </Link>
            </ContentCard>
          ) : null}

          {payment ? (
            <ContentCard variant="paper">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[var(--portal-ink)]" />
                <h3 className="portal-display text-lg font-semibold text-stone-900">
                  Payment
                </h3>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Status</dt>
                  <dd className="font-medium text-stone-900">
                    {toLabel(payment.status)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Amount</dt>
                  <dd className="portal-display font-semibold text-stone-900">
                    {payment.amount.toLocaleString()} {payment.currency}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Date</dt>
                  <dd className="font-medium text-stone-900">{payment.date}</dd>
                </div>
              </dl>
            </ContentCard>
          ) : null}
        </section>
      ) : null}

      <ContentCard variant="paper" as="section">
        <SectionHeader
          eyebrow="Itinerary"
          title="Your trip flow"
          align="stack"
        />
        <ol className="mt-8 space-y-5">
          {pkg.itinerary.map((day, i) => {
            const isLast = i === pkg.itinerary.length - 1;
            return (
              <li key={day.day} className="relative pl-14">
                {!isLast ? (
                  <span className="absolute left-5 top-10 h-full w-px bg-[var(--portal-border)]" />
                ) : null}
                <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-ink)] text-sm font-semibold text-[var(--portal-cream)]">
                  {day.day}
                </span>
                <div className="rounded-[var(--portal-radius-md)] border border-[var(--portal-border)]/60 bg-white/80 p-5">
                  <h3 className="portal-display text-lg font-semibold tracking-tight text-stone-900">
                    {day.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {day.description}
                  </p>
                  {day.accommodation ? (
                    <p className="mt-3 text-sm font-medium text-[var(--portal-ink)]">
                      Stay · {day.accommodation}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </ContentCard>

      <div className="grid gap-6 sm:grid-cols-2">
        <ContentCard variant="paper">
          <h3 className="portal-display flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Check className="h-5 w-5 text-emerald-600" />
            Inclusions
          </h3>
          <ul className="mt-4 space-y-2.5">
            {pkg.inclusions.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm leading-6 text-stone-700"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ContentCard>

        <ContentCard variant="paper">
          <h3 className="portal-display flex items-center gap-2 text-lg font-semibold text-stone-900">
            <X className="h-5 w-5 text-stone-400" />
            Exclusions
          </h3>
          <ul className="mt-4 space-y-2.5">
            {pkg.exclusions.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm leading-6 text-stone-600"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ContentCard>
      </div>

      <ContentCard variant="paper" className="text-center">
        <p className="portal-display text-base font-semibold text-stone-900">
          Questions about this tour?
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Contact us at{" "}
          <a
            href={`mailto:${settings.company.email ?? "info@paraisoceylon.com"}`}
            className="font-medium text-[var(--portal-ink)] hover:underline"
          >
            {settings.company.email ?? "info@paraisoceylon.com"}
          </a>
        </p>
      </ContentCard>
    </PortalShell>
  );
}
