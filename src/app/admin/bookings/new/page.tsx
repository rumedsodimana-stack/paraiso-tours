import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPackages } from "@/lib/db";
import { NewBookingForm } from "./NewBookingForm";

export default async function NewBookingPage() {
  const packages = await getPackages();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/bookings"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
      </div>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Add New Booking</h1>
        <p className="mt-1 text-stone-600">
          Create a booking manually or capture client inquiry details
        </p>
        <NewBookingForm packages={packages} />
      </div>
    </div>
  );
}
