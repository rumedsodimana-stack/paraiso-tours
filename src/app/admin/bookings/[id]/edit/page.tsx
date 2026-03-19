import Link from "next/link";
import { ArrowLeft, DollarSign, Building2, Car, UtensilsCrossed } from "lucide-react";
import { getLead, getPackages, getPackage, getHotels } from "@/lib/db";
import { LeadForm } from "../../LeadForm";
import { UpdateLeadForm } from "./UpdateLeadForm";
import { BookingSupplierBreakdown } from "../../BookingSupplierBreakdown";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lead, packages, suppliers] = await Promise.all([
    getLead(id),
    getPackages(),
    getHotels(),
  ]);
  const pkg = lead?.packageId ? await getPackage(lead.packageId) : null;

  if (!lead) {
    return (
      <div className="space-y-6">
        <p className="text-stone-600">Booking not found</p>
        <Link href="/admin/bookings" className="text-teal-600 hover:text-teal-700 font-medium">
          Back to bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/bookings"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
      </div>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Edit Booking</h1>
        <p className="mt-1 text-stone-600">{lead.name}</p>
        {lead.reference && (
          <div className="mt-4 rounded-xl bg-teal-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Booking Reference</p>
            <p className="mt-1 font-mono text-lg font-semibold text-teal-900">{lead.reference}</p>
          </div>
        )}
        {lead.totalPrice != null && pkg && (lead.selectedAccommodationOptionId || (lead.selectedAccommodationByNight && Object.keys(lead.selectedAccommodationByNight).length > 0) || lead.selectedTransportOptionId || lead.selectedMealOptionId) && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Selected options</p>
              <div className="mt-2 space-y-1 text-sm">
                {lead.selectedAccommodationByNight && Object.keys(lead.selectedAccommodationByNight).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(lead.selectedAccommodationByNight).map(([nightIdx, optId]) => {
                      const opts = pkg.itinerary?.[Number(nightIdx)]?.accommodationOptions ?? pkg.accommodationOptions ?? [];
                      const opt = opts.find((o) => o.id === optId);
                      return (
                        <p key={nightIdx} className="flex items-center gap-2"><Building2 className="h-4 w-4" />
                          Night {Number(nightIdx) + 1}: {opt?.label ?? "—"}
                        </p>
                      );
                    })}
                  </div>
                ) : lead.selectedAccommodationOptionId ? (
                  <p className="flex items-center gap-2"><Building2 className="h-4 w-4" />
                    Stay: {pkg.accommodationOptions?.find((o) => o.id === lead.selectedAccommodationOptionId)?.label ?? "—"}
                  </p>
                ) : null}
                {lead.selectedTransportOptionId && (
                  <p className="flex items-center gap-2"><Car className="h-4 w-4" />
                    Transport: {pkg.transportOptions?.find((o) => o.id === lead.selectedTransportOptionId)?.label ?? "—"}
                  </p>
                )}
                {lead.selectedMealOptionId && (
                  <p className="flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" />
                    Meal: {pkg.mealOptions?.find((o) => o.id === lead.selectedMealOptionId)?.label ?? "—"}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-2 font-semibold text-teal-800">
                  <DollarSign className="h-4 w-4" />
                  Total: {lead.totalPrice.toLocaleString()} {pkg.currency}
                </p>
              </div>
            </div>
            <BookingSupplierBreakdown lead={lead} pkg={pkg} suppliers={suppliers} />
          </div>
        )}
        <UpdateLeadForm lead={lead} packages={packages.map((p) => ({ id: p.id, name: p.name, destination: p.destination }))} />
      </div>
    </div>
  );
}
