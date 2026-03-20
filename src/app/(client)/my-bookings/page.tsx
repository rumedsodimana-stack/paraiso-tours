import { Suspense } from "react";
import { Mail, Route } from "lucide-react";
import { MyBookingsClient } from "./MyBookingsClient";

export default function MyBookingsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
          Booking Archive
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
          My Bookings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
          Use your email to see active requests, confirmed tours, and anything
          you&apos;ve already submitted through the portal.
        </p>
      </div>

      <div className="rounded-[2rem] border border-[#ddc8b0] bg-white/72 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-8">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-[#12343b]" />
          <h2 className="text-lg font-semibold text-stone-900">
            Look up your bookings
          </h2>
          <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-[#f7f1e7] px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-600">
            <Route className="h-3.5 w-3.5 text-[#8c6a38]" />
            Client portal
          </span>
        </div>
        <Suspense
          fallback={
            <div className="mt-4 h-24 animate-pulse rounded-[1.5rem] bg-stone-100" />
          }
        >
          <MyBookingsClient />
        </Suspense>
      </div>
    </div>
  );
}
