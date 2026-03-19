import Link from "next/link";
import { MapPin, Clock, DollarSign, ChevronRight, Star, Shield, Check, X } from "lucide-react";
import { getPackage } from "@/lib/db";
import { getFromPrice } from "@/lib/package-price";

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pkg = await getPackage(id);

  if (!pkg || pkg.published === false) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Package not found</p>
        <Link href="/packages" className="text-teal-600 hover:text-teal-700 font-medium">← Back to packages</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <Link href="/packages" className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50 hover:text-teal-700">← Back to packages</Link>

      <div className="rounded-2xl border border-white/50 bg-white/80 overflow-hidden shadow-xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row">
          <div className="aspect-video sm:aspect-auto sm:w-96 sm:min-h-[320px] shrink-0">
            {pkg.imageUrl ? (
              <img src={pkg.imageUrl} alt={pkg.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100 to-amber-100">
                <MapPin className="h-20 w-20 text-teal-400" />
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-8">
            <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{pkg.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-600">
              {pkg.rating != null && (
                <span className="flex items-center gap-1.5 font-medium text-amber-700">
                  <Star className="h-4 w-4 fill-amber-400" />
                  {pkg.rating.toFixed(1)}
                  {pkg.reviewCount != null && <span className="font-normal text-stone-500">({pkg.reviewCount} reviews)</span>}
                </span>
              )}
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{pkg.region ?? pkg.destination}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{pkg.duration}</span>
            </div>
            {pkg.cancellationPolicy && (
              <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><Shield className="h-4 w-4 shrink-0" />{pkg.cancellationPolicy}</p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1 text-2xl font-bold text-teal-600">
                <DollarSign className="h-6 w-6" />From {getFromPrice(pkg).toLocaleString()} <span className="text-base font-medium text-stone-500">{pkg.currency} / person</span>
              </span>
              <Link href={`/packages/${pkg.id}/book`} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-teal-700">Book now<ChevronRight className="h-5 w-5" /></Link>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-stone-900">Overview</h2>
        <p className="mt-3 text-stone-600 leading-relaxed">{pkg.description}</p>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-stone-900">Itinerary</h2>
        <div className="mt-6 space-y-4">
          {pkg.itinerary.map((day) => (
            <div key={day.day} className="flex gap-4 rounded-xl border border-stone-100 bg-white/50 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">{day.day}</span>
              <div>
                <h3 className="font-medium text-stone-900">{day.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{day.description}</p>
                {day.accommodation && <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500"><ChevronRight className="h-3.5 w-3.5" />Hotel: {day.accommodation}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
          <h3 className="flex items-center gap-2 font-semibold text-stone-900"><Check className="h-5 w-5 text-emerald-500" />What&apos;s included</h3>
          <ul className="mt-3 space-y-2">
            {pkg.inclusions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
          <h3 className="flex items-center gap-2 font-semibold text-stone-900"><X className="h-5 w-5 text-stone-400" />What&apos;s not included</h3>
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

      {/* Sticky CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-teal-200/50 bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium text-stone-600">From</p>
            <p className="text-xl font-bold text-teal-600">
              {getFromPrice(pkg).toLocaleString()} {pkg.currency}
              <span className="text-sm font-medium text-stone-500"> / person</span>
            </p>
          </div>
          <Link
            href={`/packages/${pkg.id}/book`}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-xl"
          >
            Book this tour
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

    </div>
  );
}
