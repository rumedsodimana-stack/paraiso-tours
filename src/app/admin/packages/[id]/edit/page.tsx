import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPackage, getHotels } from "@/lib/db";
import { UpdatePackageForm } from "./UpdatePackageForm";

export default async function EditPackagePage({
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
        <Link href="/admin/packages" className="font-medium text-teal-600 hover:text-teal-700">
          Back to packages
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/packages/${id}`}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Edit Package</h1>
        <p className="mt-1 text-stone-600">Composer view for {pkg.name}</p>
        <UpdatePackageForm pkg={pkg} hotels={hotels} />
      </div>
    </div>
  );
}
