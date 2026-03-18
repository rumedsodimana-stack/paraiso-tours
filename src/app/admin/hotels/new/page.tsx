import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HotelForm } from "../HotelForm";
import { createHotelAction } from "@/app/actions/hotels";

export default async function NewHotelPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }> | { type?: string };
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const defaultType = (params.type === "transport" ? "transport" : "hotel") as "hotel" | "transport";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/hotels"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Hotels & Suppliers
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">
          {defaultType === "transport" ? "Add Vehicle" : "Add Hotel"}
        </h1>
        <HotelForm action={createHotelAction} defaultType={defaultType} />
      </div>
    </div>
  );
}
