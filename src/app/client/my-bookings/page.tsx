import Link from "next/link";
import { Mail, Calendar, MapPin, Clock } from "lucide-react";
import { MyBookingsClient } from "./MyBookingsClient";

export default function MyBookingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">My Bookings</h1>
        <p className="mt-2 text-stone-600">
          Enter your email to see all your booking requests and confirmed tours
        </p>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-stone-900">Look up your bookings</h2>
        </div>
        <MyBookingsClient />
      </div>
    </div>
  );
}
