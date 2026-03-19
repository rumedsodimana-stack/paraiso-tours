import Link from "next/link";
import { MapPin, Mail, Phone } from "lucide-react";
import { ClientHeader } from "./ClientHeader";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-amber-50/30 to-white">
      <ClientHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="mt-auto border-t border-teal-200/50 bg-white/50 backdrop-blur-xl shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-white">
                  <MapPin className="h-4 w-4" />
                </div>
                <span className="font-semibold text-stone-800">Paraíso Ceylon Tours</span>
              </div>
              <p className="mt-3 text-sm text-stone-600">
                Crafted journeys across Sri Lanka
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-stone-800">Explore</h4>
              <ul className="mt-3 space-y-2">
                <li><Link href="/packages" className="text-sm text-stone-600 transition hover:text-teal-600">Tour packages</Link></li>
                <li><Link href="/my-bookings" className="text-sm text-stone-600 transition hover:text-teal-600">My Bookings</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-stone-800">Contact</h4>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-teal-500" /> hello@paraisoceylontours.com</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-teal-500" /> +94 11 234 5678</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-stone-800">Location</h4>
              <p className="mt-3 text-sm text-stone-600">Colombo, Sri Lanka</p>
            </div>
          </div>
          <div className="mt-10 border-t border-teal-200/50 pt-8 text-center text-sm text-stone-500">
            © {new Date().getFullYear()} Paraíso Ceylon Tours · Sri Lanka
          </div>
        </div>
      </footer>
    </div>
  );
}
