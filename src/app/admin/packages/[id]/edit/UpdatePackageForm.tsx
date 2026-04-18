"use client";

import { useRouter } from "next/navigation";
import { PackageForm } from "../../PackageForm";
import { updatePackageAction } from "@/app/actions/packages";
import type { TourPackage, HotelSupplier, HotelMealPlan } from "@/lib/types";
import type { PlannerDestination } from "@/lib/route-planner";

export function UpdatePackageForm({
  pkg,
  hotels = [],
  destinations = [],
  allMealPlans = [],
}: {
  pkg: TourPackage;
  hotels?: HotelSupplier[];
  destinations?: PlannerDestination[];
  allMealPlans?: HotelMealPlan[];
}) {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const result = await updatePackageAction(pkg.id, formData);
    if (result?.error) return { error: result.error };
    router.push(`/admin/packages/${pkg.id}?saved=1`);
    router.refresh();
  }

  return (
    <PackageForm
      pkg={pkg}
      hotels={hotels}
      destinations={destinations}
      allMealPlans={allMealPlans}
      onSubmit={handleSubmit}
    />
  );
}
