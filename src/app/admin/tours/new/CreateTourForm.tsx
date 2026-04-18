"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTourAction } from "@/app/actions/tours";
import type { Lead, TourPackage } from "@/lib/types";

export function CreateTourForm({
  leads,
  packages,
}: {
  leads: Lead[];
  packages: TourPackage[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLeadId = searchParams.get("leadId");
  const initialLead =
    initialLeadId != null ? leads.find((lead) => lead.id === initialLeadId) ?? null : null;
  const initialPackageId =
    initialLead?.packageId && packages.some((pkg) => pkg.id === initialLead.packageId)
      ? initialLead.packageId
      : "";
  const [error, setError] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(initialLead);
  const [selectedPackageId, setSelectedPackageId] = useState(initialPackageId);
  const [pax, setPax] = useState(String(initialLead?.pax ?? 1));

  function handleLeadChange(lead: Lead | null) {
    setSelectedLead(lead);
    if (lead?.packageId && packages.some((p) => p.id === lead.packageId)) {
      setSelectedPackageId(lead.packageId);
    } else {
      setSelectedPackageId("");
    }
    setPax(String(lead?.pax ?? 1));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    const result = await createTourAction(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/calendar?saved=1");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="leadId" className="block text-sm font-medium text-[#11272b]">
            Client (Booking) *
          </label>
          <select
            id="leadId"
            name="leadId"
            required
            value={selectedLead?.id ?? ""}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            onChange={(e) => {
              const lead = leads.find((l) => l.id === e.target.value);
              handleLeadChange(lead ?? null);
            }}
          >
            <option value="">Select a lead...</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name} ({lead.email}) - {lead.status}
              </option>
            ))}
          </select>
          {leads.length === 0 && (
            <p className="mt-2 text-sm text-amber-600">
              No bookable bookings. Mark bookings as &quot;quoted&quot; or &quot;won&quot; first.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="packageId" className="block text-sm font-medium text-[#11272b]">
            Package *
          </label>
          <select
            id="packageId"
            name="packageId"
            required
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            <option value="">Select a package...</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} - {pkg.price} {pkg.currency}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-[#11272b]">
            Start Date *
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="pax" className="block text-sm font-medium text-[#11272b]">
            Number of Travelers
          </label>
          <input
            id="pax"
            name="pax"
            type="number"
            min={1}
            value={pax}
            onChange={(e) => setPax(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>
      <input type="hidden" name="clientName" value={selectedLead?.name ?? ""} />
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-xl bg-[#12343b] px-6 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          Schedule Tour
        </button>
      </div>
    </form>
  );
}
