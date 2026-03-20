import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, Search } from "lucide-react";
import { homeHeroScene } from "../client-visuals";

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="space-y-8 pb-10">
      <section
        className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[#12343b] text-[#f7ead7] shadow-[0_28px_70px_-34px_rgba(18,52,59,0.95)]"
        style={{
          backgroundImage: `linear-gradient(120deg, rgba(11,33,38,0.92) 10%, rgba(11,33,38,0.64) 48%, rgba(11,33,38,0.22) 100%), url(${homeHeroScene.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative px-6 py-10 sm:px-8 sm:py-12 lg:px-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#efd5aa] backdrop-blur-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Request received
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Your route request is in
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e5dccd] sm:text-base">
              Our team will review the trip setup, confirm availability, and
              follow up with the next step from the admin side.
            </p>

            {ref ? (
              <div className="mt-6 inline-flex flex-col rounded-[1.5rem] border border-white/12 bg-white/10 px-5 py-4 backdrop-blur-sm">
                <span className="text-xs uppercase tracking-[0.26em] text-[#e5c48e]">
                  Booking reference
                </span>
                <span className="mt-2 font-mono text-2xl font-semibold text-white">
                  {ref}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-4 text-lg font-semibold text-stone-900">
            Step 1: Request logged
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Your booking is now in the same operations pipeline the admin team
            uses for leads and scheduling.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <Mail className="h-6 w-6 text-[#12343b]" />
          <h2 className="mt-4 text-lg font-semibold text-stone-900">
            Step 2: Watch your inbox
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            We&apos;ll confirm availability and send the next update to your
            email once the team reviews the request.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm">
          <Search className="h-6 w-6 text-[#12343b]" />
          <h2 className="mt-4 text-lg font-semibold text-stone-900">
            Step 3: Track the status
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Use your email or reference in the client area to see when the
            request becomes a confirmed tour.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/my-bookings"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#12343b] px-6 py-3.5 text-sm font-semibold text-[#f6ead6] shadow-[0_16px_40px_-26px_rgba(18,52,59,0.95)]"
        >
          View my bookings
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/packages"
          className="inline-flex items-center justify-center rounded-full border border-[#ddc8b0] bg-white/72 px-6 py-3.5 text-sm font-semibold text-stone-800 backdrop-blur-sm"
        >
          Browse more packages
        </Link>
      </div>
    </div>
  );
}
