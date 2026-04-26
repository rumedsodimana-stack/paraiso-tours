import Link from "next/link";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
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

  if (typeParam === "meal") {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/hotels"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Hotels
        </Link>
        <div className="paraiso-card rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eef4f4] text-[#12343b]">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#11272b]">Meal plans moved</h1>
              <p className="mt-2 text-sm leading-6 text-[#5e7279]">
                Meal plans are now managed per-hotel. Open a hotel&apos;s detail
                page and use the <b>Meal Plans</b> section to add breakfast,
                half-board, full-board, or any custom plan with per-person pricing.
              </p>
              <Link
                href="/admin/hotels"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-5 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
              >
                Choose a hotel
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const defaultType = (
    typeParam === "transport"
      ? "transport"
      : typeParam === "supplier"
        ? "supplier"
        : "hotel"
  ) as "hotel" | "transport" | "meal" | "supplier";

  const formTitle =
    defaultType === "transport"
      ? "Add Vehicle"
      : defaultType === "supplier"
        ? "Add Supplier"
        : "Add Hotel";

  // Contextual back-link: vehicles return to /admin/transportation, hotels
  // and generic suppliers return to /admin/hotels.
  const backHref =
    defaultType === "transport" ? "/admin/transportation" : "/admin/hotels";
  const backLabel =
    defaultType === "transport"
      ? "Back to Transportation"
      : defaultType === "supplier"
        ? "Back to Suppliers"
        : "Back to Hotels";

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        {backLabel}
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="text-xl font-semibold text-[#11272b]">{formTitle}</h1>
        <HotelForm action={createHotelAction as Parameters<typeof HotelForm>[0]["action"]} defaultType={defaultType} defaultDestinationId={destinationId} />
      </div>
    </div>
  );
}
