"use client";

import { useRouter } from "next/navigation";
import { LeadForm } from "../../LeadForm";
import { updateLeadAction } from "@/app/actions/leads";
import type { Lead } from "@/lib/types";

export function UpdateLeadForm({ lead }: { lead: Lead }) {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const result = await updateLeadAction(lead.id, formData);
    if (result.error) {
      return { error: result.error };
    }
    router.push("/leads");
    router.refresh();
  }

  return <LeadForm lead={lead} onSubmit={handleSubmit} />;
}
