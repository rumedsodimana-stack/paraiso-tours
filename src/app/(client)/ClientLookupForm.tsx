"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin } from "lucide-react";

export function ClientLookupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookingRef, setBookingRef] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "notfound") {
      setError("Booking not found. Please check your reference and email.");
      router.replace("/");
    }
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const refTrim = bookingRef.trim();
    const emailTrim = email.trim();
    if (!refTrim && !emailTrim) {
      setError("Please enter your booking reference or email.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (refTrim) params.set("ref", refTrim);
      if (emailTrim) params.set("email", emailTrim);
      const res = await fetch(`/api/client/booking?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        if (data.redirect === "/my-bookings" && data.email) {
          router.push(`/my-bookings?email=${encodeURIComponent(data.email)}`);
        } else {
          router.push(
            `/booking/${encodeURIComponent(refTrim)}${emailTrim ? `?email=${encodeURIComponent(emailTrim)}` : ""}`
          );
        }
      } else {
        setError(data.error || "Booking not found. Please check your reference or email.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/50 bg-white/60 p-8 shadow-xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100">
            <MapPin className="h-8 w-8 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            View Your Booking
          </h1>
          <p className="mt-2 text-stone-600">
            Enter your booking reference <span className="text-stone-500">or</span> email to find your booking
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="ref" className="block text-sm font-medium text-stone-700">
              Booking Reference
            </label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="ref"
                type="text"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="e.g. PCT-20260312-A3B7"
                className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Find this in your confirmation email
            </p>
          </div>
          <p className="text-center text-sm text-stone-500">— or —</p>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white py-3 px-4 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-600 py-3 font-medium text-white transition hover:bg-teal-700 disabled:opacity-70"
          >
            {loading ? "Checking…" : "View Booking"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-stone-500">
        Demo: Reference <code className="rounded bg-stone-200 px-1">PCT-20260312-X7K2</code> or email{" "}
        <code className="rounded bg-stone-200 px-1">john.mitchell@email.com</code>
      </p>
    </div>
  );
}
