"use client";

import { useRouter } from "next/navigation";
import { LeadForm } from "../../LeadForm";
import { updateLeadAction } from "@/app/actions/leads";
import type { Lead } from "@/lib/types";

export function UpdateLeadForm({
  lead,
  packages = [],
}: {
  lead: Lead;
  packages?: { id: string; name: string; destination?: string }[];
}) {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const result = await updateLeadAction(lead.id, formData);
    if (result.error) {
      return { error: result.error };
    }
    router.push("/admin/bookings?saved=1");
    router.refresh();
  }

  return <LeadForm lead={lead} packages={packages} onSubmit={handleSubmit} />;
}
