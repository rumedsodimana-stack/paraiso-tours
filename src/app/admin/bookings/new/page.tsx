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
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
      </div>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-[#11272b]">Add New Booking</h1>
        <p className="mt-1 text-[#5e7279]">
          Create a booking manually or capture client inquiry details
        </p>
        <NewBookingForm packages={packages} />
      </div>
    </div>
  );
}
