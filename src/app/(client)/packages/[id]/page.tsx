import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { getPackage } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";
import { getClientPackageVisual } from "../../client-visuals";

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pkg = await getPackage(id);

  if (!pkg || pkg.published === false) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Package not found</p>
        <Link
          href="/packages"
          className="font-medium text-[#12343b] hover:text-[#0f2b31]"
        >
          Back to packages
        </Link>
      </div>
    );
  }

  const visual = getClientPackageVisual(pkg);

  return (
    <div className="space-y-8 pb-24">
      <Link
        href="/packages"
        className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 backdrop-blur-sm transition hover:text-[#12343b]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to packages
      </Link>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_28px_70px_-34px_rgba(18,52,59,0.95)]">
        <div className="absolute inset-0">
          <Image
            src={visual.imageUrl}
            alt={pkg.name}
            fill
            unoptimized
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(11,33,38,0.92)_8%,rgba(11,33,38,0.62)_46%,rgba(11,33,38,0.24)_100%)]" />
        </div>

        <div className="relative grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-12">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[#e5c48e]">
              {visual.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              {pkg.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#ece1cf]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {pkg.region ?? pkg.destination}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                {pkg.duration}
              </span>
              {(pkg.rating ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[#f7d895]">
                  <Star className="h-4 w-4 fill-current" />
                  {pkg.rating?.toFixed(1)}
                  {pkg.reviewCount != null && (
                    <span className="text-[#ece1cf]">({pkg.reviewCount})</span>
                  )}
                </span>
              )}
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#e1d8ca] sm:text-base">
              {pkg.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {visual.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[#efe3d0]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-6 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.28em] text-[#e5c48e]">
              Route Snapshot
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {visual.highlight}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#dfd7c6]">
              {visual.microcopy}
            </p>

            {pkg.cancellationPolicy && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm text-[#efe3d0]">
                <ShieldCheck className="h-4 w-4 text-[#f2dfbf]" />
                {pkg.cancellationPolicy}
              </div>
            )}

            <div className="mt-8 rounded-[1.5rem] bg-[#f5e2c3] p-5 text-[#12343b]">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7d5b2a]">
                From
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {getFromPrice(pkg).toLocaleString()} {pkg.currency}
              </p>
              <p className="mt-1 text-sm text-[#5d4a2c]">per traveller</p>
              <Link
                href={`/packages/${pkg.id}/book`}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#12343b] px-5 py-3 text-sm font-semibold text-[#f6ead6]"
              >
                Book this tour
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/70 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
            Trip Overview
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
            Day-by-day route
          </h2>

          <div className="mt-8 space-y-5">
            {pkg.itinerary.map((day) => (
              <div key={day.day} className="relative pl-12">
                <div className="absolute left-4 top-10 h-full w-px bg-[#ddc8b0]" />
                <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#12343b] text-sm font-semibold text-[#f6ead6]">
                  {day.day}
                </div>
                <div className="rounded-[1.5rem] border border-[#eadfce] bg-[#fbf7f1] p-5">
                  <h3 className="text-lg font-semibold text-stone-900">
                    {day.title}
                  </h3>
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
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/70 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
              Included
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
              What&apos;s in the route
            </h3>
            <ul className="mt-5 space-y-3">
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

          <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/70 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
              Exclusions
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
              Plan separately
            </h3>
            <ul className="mt-5 space-y-3">
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
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#d7c2a4] bg-[#f8f0e4]/96 shadow-[0_-18px_48px_-32px_rgba(43,32,15,0.6)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#8c6a38]">
              Starting from
            </p>
            <p className="mt-1 text-xl font-semibold text-[#12343b]">
              {getFromPrice(pkg).toLocaleString()} {pkg.currency}
              <span className="text-sm font-medium text-stone-500">
                {" "}
                / traveller
              </span>
            </p>
          </div>
          <Link
            href={`/packages/${pkg.id}/book`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#12343b] px-6 py-3 font-semibold text-[#f6ead6]"
          >
            Book this route
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
