import Link from "next/link";
import { ArrowLeft, Pencil, Landmark, MapPin, Building2, Car, UtensilsCrossed } from "lucide-react";
import { notFound } from "next/navigation";
import { getHotel } from "@/lib/db";
import { SaveSuccessBanner } from "../../SaveSuccessBanner";
import { DeleteHotelButton } from "../DeleteHotelButton";

const typeIcons = { hotel: Building2, transport: Car, meal: UtensilsCrossed, supplier: MapPin };
const typeLabels = { hotel: "Hotel", transport: "Transport", meal: "Meal Provider", supplier: "Supplier" };

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      <p className="mt-0.5 text-stone-900 dark:text-stone-50">{value}</p>
    </div>
  );
}

export default async function HotelProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = searchParams ? await searchParams : {};
  const hotel = await getHotel(id);
  if (!hotel) notFound();

  const Icon = typeIcons[hotel.type];
  const hasBanking =
    hotel.bankName || hotel.bankBranch || hotel.accountName || hotel.accountNumber || hotel.swiftCode;

  return (
    <div className="space-y-6">
      {saved === "1" && <SaveSuccessBanner message={`${typeLabels[hotel.type]} saved successfully`} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/hotels"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Hotels & Suppliers
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/hotels/${id}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-medium text-teal-600 transition hover:bg-teal-50 dark:bg-stone-900 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <DeleteHotelButton id={hotel.id} name={hotel.name} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">{hotel.name}</h1>
            <p className="text-stone-500">{typeLabels[hotel.type]}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <DetailRow label="Location" value={hotel.location} />
          <DetailRow label="Email" value={hotel.email} />
          <DetailRow label="Phone / Contact" value={hotel.contact} />
          <DetailRow
            label={
              hotel.type === "meal"
                ? "Default price per person / day"
                : hotel.type === "transport"
                  ? "Default vehicle rate / day"
                  : "Default rate"
            }
            value={
              hotel.defaultPricePerNight != null
                ? `${hotel.defaultPricePerNight.toLocaleString()} ${hotel.currency}`
                : null
            }
          />
          <DetailRow
            label="Concurrent capacity"
            value={hotel.maxConcurrentBookings ?? null}
          />
          {hotel.type === "hotel" && hotel.starRating != null && (
            <DetailRow label="Star rating" value={`${hotel.starRating} Star`} />
          )}
        </div>

        {hotel.notes && (
          <div className="mt-6">
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Notes</span>
            <p className="mt-1 whitespace-pre-wrap text-stone-700 dark:text-stone-300">{hotel.notes}</p>
          </div>
        )}

        {hasBanking && (
          <div className="mt-8 rounded-xl border border-stone-200/60 bg-white/40 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-700">
              <Landmark className="h-4 w-4" />
              Banking Details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Bank name" value={hotel.bankName} />
              <DetailRow label="Branch" value={hotel.bankBranch} />
              <DetailRow label="Account name" value={hotel.accountName} />
              <DetailRow label="Account number" value={hotel.accountNumber} />
              <DetailRow label="SWIFT / BIC" value={hotel.swiftCode} />
              <DetailRow label="Bank currency" value={hotel.bankCurrency} />
              <DetailRow label="Payment reference" value={hotel.paymentReference} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
