import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarRange, MapPin, Star } from "lucide-react";
import { getPackage, getHotels } from "@/lib/db";
import { ClientBookingForm } from "./ClientBookingForm";
import { getClientPackageVisual } from "../../../client-visuals";

export default async function ClientBookPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pkg, hotels] = await Promise.all([getPackage(id), getHotels()]);

  if (!pkg) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Package not found</p>
        <Link
          href="/packages"
          className="text-teal-600 hover:text-teal-700 font-medium"
        >
          ← Back to packages
        </Link>
      </div>
    );
  }

  const visual = getClientPackageVisual(pkg);

  return (
    <div className="space-y-8 pb-10">
      <Link
        href={`/packages/${id}`}
        className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 backdrop-blur-sm transition hover:text-[#12343b]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tour details
      </Link>

      <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_28px_70px_-34px_rgba(18,52,59,0.95)]">
          <div className="relative min-h-[26rem]">
            <Image
              src={visual.imageUrl}
              alt={pkg.name}
              fill
              unoptimized
              className="absolute inset-0 object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(11,33,38,0.92)_10%,rgba(11,33,38,0.6)_48%,rgba(11,33,38,0.22)_100%)]" />

            <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#e5c48e]">
                  {visual.eyebrow}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  {pkg.name}
                </h1>
                <p className="mt-4 text-sm leading-7 text-[#e5dccd]">
                  {visual.highlight}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-[#ece1cf]">
                    <MapPin className="h-4 w-4 text-[#f2dfbf]" />
                    {pkg.region ?? pkg.destination}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#ece1cf]">
                    <CalendarRange className="h-4 w-4 text-[#f2dfbf]" />
                    {pkg.duration}
                  </div>
                  {(pkg.rating ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm text-[#f7d895]">
                      <Star className="h-4 w-4 fill-current" />
                      {pkg.rating?.toFixed(1)} guest rating
                    </div>
                  )}
                </div>

                <div className="rounded-[1.5rem] bg-[#f5e2c3] p-4 text-[#12343b]">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#7d5b2a]">
                    Route note
                  </p>
                  <p className="mt-2 text-sm leading-6">{visual.microcopy}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-[2rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
              Booking Request
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
              Shape the stay before you submit
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              Choose your transport, accommodation style, and meal plan, then
              leave your preferred date and contact details.
            </p>
          </div>

          <ClientBookingForm pkg={pkg} hotels={hotels} />
        </section>
      </div>
    </div>
  );
}
