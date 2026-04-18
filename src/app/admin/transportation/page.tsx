import Link from "next/link";
import { Car, ChevronRight, Plus, Users } from "lucide-react";
import { getHotels } from "@/lib/db";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export const dynamic = "force-dynamic";

export default async function TransportationPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { saved } = searchParams ? await searchParams : {};
  const allHotels = await getHotels();
  const suppliers = allHotels.filter((h) => h.type === "transport" && !h.archivedAt);

  return (
    <div className="space-y-6">
      {saved === "1" && <SaveSuccessBanner message="Transport supplier saved" />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Transportation</h1>
          <p className="mt-1 text-sm text-[#5e7279]">
            Vehicle fleet and transport supplier agreements
          </p>
        </div>
        <Link
          href="/admin/hotels/new?type=transport"
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          <Plus className="h-4 w-4" />
          Add Vehicle
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16">
          <Car className="h-10 w-10 text-[#8a9ba1]" />
          <p className="mt-4 text-[#5e7279]">
            No transport suppliers yet. Add your first vehicle or service.
          </p>
          <Link
            href="/admin/hotels/new?type=transport"
            className="mt-4 font-medium text-[#12343b] hover:underline"
          >
            Add Transport Supplier
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Link
              key={s.id}
              href={`/admin/hotels/${s.id}`}
              className="paraiso-card group flex items-start justify-between gap-3 rounded-2xl p-4 transition hover:bg-[#f4ecdd]"
            >
              <div className="flex gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef4f4] text-[#12343b]">
                  <Car className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#11272b] truncate">{s.name}</p>
                  {s.location && (
                    <p className="mt-0.5 text-sm text-[#5e7279] truncate">{s.location}</p>
                  )}
                  {s.capacity != null && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#8a9ba1]">
                      <Users className="h-3 w-3" />
                      {s.capacity} pax
                    </p>
                  )}
                  {s.defaultPricePerNight != null && (
                    <p className="mt-1 text-sm font-semibold text-[#12343b]">
                      {s.defaultPricePerNight.toLocaleString()} {s.currency}
                      <span className="font-normal text-[#8a9ba1]">/day</span>
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#8a9ba1] transition group-hover:text-[#12343b] mt-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
