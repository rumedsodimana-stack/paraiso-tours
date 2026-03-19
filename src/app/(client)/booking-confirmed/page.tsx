import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="rounded-2xl border border-white/50 bg-white/80 p-10 shadow-xl backdrop-blur-xl">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 shadow-inner">
          <CheckCircle className="h-14 w-14 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold text-stone-900">
          Request received!
        </h1>
        {ref && (
          <div className="mt-4 rounded-xl bg-teal-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
              Your booking reference
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-teal-900">
              {ref}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Save this number to track your request in My Bookings
            </p>
          </div>
        )}
        <p className="mt-4 text-stone-600">
          Thank you for your interest. Our team will review your request and
          send you a personalised quote within 24 hours.
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Check your email for updates. You can view your booking status in{" "}
          <Link href="/my-bookings" className="text-teal-600 hover:underline">
            My Bookings
          </Link>{" "}
          anytime.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/my-bookings"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 hover:shadow-xl"
          >
            My Bookings
          </Link>
          <Link
            href="/packages"
            className="inline-flex items-center justify-center rounded-xl border-2 border-stone-200 bg-white px-8 py-3.5 text-sm font-semibold text-stone-800 transition hover:border-teal-200 hover:bg-teal-50/50"
          >
            Browse more packages
          </Link>
        </div>
      </div>
    </div>
  );
}
