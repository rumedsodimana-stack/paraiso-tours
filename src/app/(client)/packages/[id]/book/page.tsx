import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getPackage, getHotels } from "@/lib/db";
import { ClientBookingForm } from "./ClientBookingForm";

export default async function ClientBookPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pkg, hotels] = await Promise.all([getPackage(id), getHotels()]);

  if (!pkg) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Package not found</p>
        <Link
          href="/packages"
          className="text-teal-600 hover:text-teal-700 font-medium"
        >
          ← Back to packages
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href={`/packages/${id}`}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50 hover:text-teal-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tour details
      </Link>

      <div className="rounded-2xl border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-600/20">
            <MapPin className="h-7 w-7 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{pkg.name}</h1>
            <p className="mt-1 text-sm text-stone-600">
              {pkg.duration} · {pkg.region ?? pkg.destination}
            </p>
          </div>
        </div>

        <p className="mb-8 text-stone-600 leading-relaxed">{pkg.description}</p>

        <ClientBookingForm pkg={pkg} hotels={hotels} />
      </div>
    </div>
  );
}
