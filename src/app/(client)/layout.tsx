import Link from "next/link";
import { MapPin } from "lucide-react";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-amber-50/30 to-white">
      <header className="border-b border-teal-200/50 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white">
                <MapPin className="h-5 w-5" />
              </div>
              <span className="text-xl font-semibold text-stone-800">
                Paraíso Ceylon Tours
              </span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/packages"
                className="text-sm font-medium text-stone-600 hover:text-teal-600"
              >
                Packages
              </Link>
              <Link
                href="/my-bookings"
                className="text-sm font-medium text-stone-600 hover:text-teal-600"
              >
                My Bookings
              </Link>
              <Link
                href="/"
                className="text-sm font-medium text-stone-600 hover:text-teal-600"
              >
                View booking
              </Link>
            </nav>
          </div>
          <Link
            href="/admin"
            className="text-sm text-stone-500 hover:text-teal-600"
          >
            Staff login →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
      <footer className="border-t border-teal-200/50 py-6 text-center text-sm text-stone-500">
        © Paraíso Ceylon Tours · Sri Lanka
      </footer>
    </div>
  );
}
