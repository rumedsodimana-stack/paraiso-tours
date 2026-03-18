"use client";

import { useRouter } from "next/navigation";
import { PackageForm } from "../../PackageForm";
import { updatePackageAction } from "@/app/actions/packages";
import type { TourPackage } from "@/lib/types";

export function UpdatePackageForm({ pkg }: { pkg: TourPackage }) {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const result = await updatePackageAction(pkg.id, formData);
    if (result?.error) return { error: result.error };
    router.push(`/packages/${pkg.id}`);
    router.refresh();
  }

  return <PackageForm pkg={pkg} onSubmit={handleSubmit} />;
}
