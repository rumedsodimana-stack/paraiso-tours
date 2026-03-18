import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getPackage } from "@/lib/db";
import { ClientBookingForm } from "./ClientBookingForm";

export default async function ClientBookPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pkg = await getPackage(id);

  if (!pkg) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Package not found</p>
        <Link
          href="/client/packages"
          className="text-teal-600 hover:text-teal-700 font-medium"
        >
          ← Back to packages
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/client/packages"
          className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to packages
        </Link>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100">
            <MapPin className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">{pkg.name}</h1>
            <p className="text-sm text-stone-500">
              {pkg.duration} · {pkg.destination}
            </p>
          </div>
        </div>

        <p className="mb-6 text-stone-600">{pkg.description}</p>

        <ClientBookingForm pkg={pkg} />
      </div>
    </div>
  );
}
