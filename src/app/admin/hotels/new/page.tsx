import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HotelForm } from "../HotelForm";
import { createHotelAction } from "@/app/actions/hotels";

export default async function NewHotelPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; destination?: string }> | { type?: string; destination?: string };
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const typeParam = params.type;
  const destinationId = params.destination ?? undefined;
  const defaultType = (
    typeParam === "transport"
      ? "transport"
      : typeParam === "meal"
        ? "meal"
        : typeParam === "supplier"
          ? "supplier"
          : "hotel"
  ) as "hotel" | "transport" | "meal" | "supplier";

  const formTitle =
    defaultType === "transport"
      ? "Add Vehicle"
      : defaultType === "meal"
        ? "Add Meal Provider"
        : defaultType === "supplier"
          ? "Add Supplier"
          : "Add Hotel";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/hotels"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Hotels & Suppliers
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-xl font-semibold text-[#11272b]">{formTitle}</h1>
        <HotelForm action={createHotelAction as Parameters<typeof HotelForm>[0]["action"]} defaultType={defaultType} defaultDestinationId={destinationId} />
      </div>
    </div>
  );
}
