import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getHotels } from "@/lib/db";
import { NewPackageForm } from "./NewPackageForm";

export default async function NewPackagePage() {
  const hotels = await getHotels();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/packages"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Create Tour Package</h1>
        <p className="mt-1 text-stone-600">Use the composer to map nights, suppliers, and live pricing in one place.</p>
        <NewPackageForm hotels={hotels} />
      </div>
    </div>
  );
}
