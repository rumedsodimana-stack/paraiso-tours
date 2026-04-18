import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getHotels, getAllMealPlans } from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";
import { NewPackageForm } from "./NewPackageForm";

export default async function NewPackagePage() {
  const [hotels, allMealPlans] = await Promise.all([getHotels(), getAllMealPlans()]);
  const destinations = getPlannerDestinations().filter((d) => d.id !== "airport");

  return (
    <div className="space-y-6">
      <Link
        href="/admin/packages"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>
      <div className="rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-[#11272b]">Create Tour Package</h1>
        <p className="mt-1 text-sm text-[#5e7279]">Use the composer to map nights, suppliers, and live pricing in one place.</p>
        <NewPackageForm hotels={hotels} destinations={destinations} allMealPlans={allMealPlans} />
      </div>
    </div>
  );
}
