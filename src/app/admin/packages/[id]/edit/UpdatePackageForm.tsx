"use client";

import { useRouter } from "next/navigation";
import { PackageForm } from "../../PackageForm";
import { updatePackageAction } from "@/app/actions/packages";
import type { TourPackage, HotelSupplier } from "@/lib/types";

export function UpdatePackageForm({ pkg, hotels = [] }: { pkg: TourPackage; hotels?: HotelSupplier[] }) {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const result = await updatePackageAction(pkg.id, formData);
    if (result?.error) return { error: result.error };
    router.push(`/admin/packages/${pkg.id}?saved=1`);
    router.refresh();
  }

  return <PackageForm pkg={pkg} hotels={hotels} onSubmit={handleSubmit} />;
}
