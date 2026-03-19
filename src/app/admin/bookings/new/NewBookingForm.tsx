"use client";

import { useRouter } from "next/navigation";
import { LeadForm } from "../LeadForm";
import { createLeadAction } from "@/app/actions/leads";
import type { TourPackage } from "@/lib/types";

export function NewBookingForm({ packages }: { packages: TourPackage[] }) {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const result = await createLeadAction(formData);
    if (result.error) {
      return { error: result.error };
    }
    router.push("/admin/bookings?saved=1");
    router.refresh();
  }

  return (
    <LeadForm
      packages={packages.map((p) => ({ id: p.id, name: p.name, destination: p.destination }))}
      onSubmit={handleSubmit}
    />
  );
}
