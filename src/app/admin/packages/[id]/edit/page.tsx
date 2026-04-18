import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPackage, getHotels, getAllMealPlans } from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";
import { UpdatePackageForm } from "./UpdatePackageForm";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pkg, hotels, allMealPlans] = await Promise.all([getPackage(id), getHotels(), getAllMealPlans()]);
  const destinations = getPlannerDestinations().filter((d) => d.id !== "airport");

  if (!pkg) {
    return (
      <div className="space-y-6">
        <p className="text-[#5e7279]">Package not found</p>
        <Link href="/admin/packages" className="font-medium text-[#12343b] hover:text-[#1a474f]">
          Back to packages
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/packages/${id}`}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-[#11272b]">Edit Package</h1>
        <p className="mt-1 text-[#5e7279]">Composer view for {pkg.name}</p>
        <UpdatePackageForm pkg={pkg} hotels={hotels} destinations={destinations} allMealPlans={allMealPlans} />
      </div>
    </div>
  );
}
