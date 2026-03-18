import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="rounded-2xl border border-white/50 bg-white/70 p-8 shadow-xl backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle className="h-12 w-12 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900">
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
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/my-bookings"
            className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            My Bookings
          </Link>
          <Link
            href="/packages"
            className="rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Browse more packages
          </Link>
        </div>
      </div>
    </div>
  );
}
