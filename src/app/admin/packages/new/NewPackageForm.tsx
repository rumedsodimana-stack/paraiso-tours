"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PackageForm } from "../PackageForm";
import { createPackageAction } from "@/app/actions/packages";
import type { HotelSupplier } from "@/lib/types";

export function NewPackageForm({ hotels }: { hotels: HotelSupplier[] }) {
  async function handleSubmit(formData: FormData) {
    const result = await createPackageAction(formData);
    if (result.error) return { error: result.error };
    window.location.href = "/admin/packages?saved=1";
  }

  return (
    <PackageForm hotels={hotels} onSubmit={handleSubmit} />
  );
}
