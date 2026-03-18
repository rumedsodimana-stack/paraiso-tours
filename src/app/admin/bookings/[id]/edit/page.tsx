import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLead, getPackages } from "@/lib/db";
import { LeadForm } from "../../LeadForm";
import { UpdateLeadForm } from "./UpdateLeadForm";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lead, packages] = await Promise.all([getLead(id), getPackages()]);

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
        <UpdateLeadForm lead={lead} packages={packages.map((p) => ({ id: p.id, name: p.name, destination: p.destination }))} />
      </div>
    </div>
  );
}
