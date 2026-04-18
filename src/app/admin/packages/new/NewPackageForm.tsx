"use client";

import { PackageForm } from "../PackageForm";
import { createPackageAction } from "@/app/actions/packages";
import type { HotelSupplier, HotelMealPlan } from "@/lib/types";
import type { PlannerDestination } from "@/lib/route-planner";

export function NewPackageForm({
  hotels,
  destinations,
  allMealPlans,
}: {
  hotels: HotelSupplier[];
  destinations: PlannerDestination[];
  allMealPlans: HotelMealPlan[];
}) {
  async function handleSubmit(formData: FormData) {
    const result = await createPackageAction(formData);
    if (result.error) return { error: result.error };
    window.location.href = "/admin/packages?saved=1";
  }

  return (
    <PackageForm
      hotels={hotels}
      destinations={destinations}
      allMealPlans={allMealPlans}
      onSubmit={handleSubmit}
    />
  );
}
