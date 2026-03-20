"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, Search } from "lucide-react";
import { debugClient } from "@/lib/debug";

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
    debugClient("ClientLookup: search", { ref: refTrim || undefined, email: emailTrim ? "***" : undefined });
    try {
      const params = new URLSearchParams();
      if (refTrim) params.set("ref", refTrim);
      if (emailTrim) params.set("email", emailTrim);
      const res = await fetch(`/api/client/booking?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        debugClient("ClientLookup: found", { redirect: data.redirect, hasEmail: !!data.email });
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
    } catch (err) {
      debugClient("ClientLookup: error", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-[1.75rem] border border-[#ddc8b0] bg-white/82 p-6 shadow-[0_18px_44px_-32px_rgba(43,32,15,0.5)] backdrop-blur-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[#12343b] text-[#f6ead6]">
            <Compass className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            View Your Booking
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Enter your booking reference or email to reopen your trip details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="ref" className="block text-sm font-medium text-stone-700">
              Booking Reference
            </label>
            <div className="relative mt-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="ref"
                type="text"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="e.g. PCT-20260312-A3B7"
                className="w-full rounded-[1rem] border border-[#ddc8b0] bg-white py-3 pl-11 pr-4 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
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
              className="mt-1 w-full rounded-[1rem] border border-[#ddc8b0] bg-white px-4 py-3 focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#12343b] py-3.5 font-semibold text-[#f6ead6] shadow-[0_16px_40px_-26px_rgba(18,52,59,0.95)] transition hover:bg-[#0f2b31] disabled:opacity-70"
          >
            {loading ? "Checking…" : "View Booking"}
          </button>
        </form>
      </div>
    </div>
  );
}
