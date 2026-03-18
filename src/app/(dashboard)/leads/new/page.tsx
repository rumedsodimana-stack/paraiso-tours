"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadForm } from "../LeadForm";
import { createLeadAction } from "@/app/actions/leads";

export default function NewLeadPage() {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const result = await createLeadAction(formData);
    if (result.error) {
      return { error: result.error };
    }
    router.push("/leads");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/leads"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
      </div>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Add New Lead</h1>
        <p className="mt-1 text-stone-600">Capture client inquiry details</p>
        <LeadForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
