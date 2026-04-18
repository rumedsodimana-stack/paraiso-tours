import Link from "next/link";
import { ArrowLeft, Pencil, Landmark, MapPin, Building2, Car, UtensilsCrossed } from "lucide-react";
import { notFound } from "next/navigation";
import { getHotel, getHotelMealPlans } from "@/lib/db";
import { SaveSuccessBanner } from "../../SaveSuccessBanner";
import { DeleteHotelButton } from "../DeleteHotelButton";
import { MealPlanManager } from "./MealPlanManager";

const typeIcons = { hotel: Building2, transport: Car, meal: UtensilsCrossed, supplier: MapPin };
const typeLabels = { hotel: "Hotel", transport: "Transport", meal: "Meal Provider", supplier: "Supplier" };

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-[#8a9ba1]">{label}</span>
      <p className="mt-0.5 text-[#11272b]">{value}</p>
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
  const [hotel, mealPlans] = await Promise.all([getHotel(id), getHotelMealPlans(id)]);
  if (!hotel) notFound();

  const Icon = typeIcons[hotel.type];
  const hasBanking =
    hotel.bankName || hotel.bankBranch || hotel.accountName || hotel.accountNumber || hotel.swiftCode;

  return (
    <div className="space-y-6">
      {saved === "1" && <SaveSuccessBanner message={`${typeLabels[hotel.type]} saved successfully`} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={
            hotel.type === "transport"
              ? "/admin/transportation"
              : hotel.destinationId
                ? `/admin/destinations/${hotel.destinationId}`
                : "/admin/destinations"
          }
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
        >
          <ArrowLeft className="h-5 w-5" />
          {hotel.type === "transport"
            ? "Back to Transportation"
            : hotel.destinationId
              ? "Back to Destination"
              : "Back to Destinations"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/hotels/${id}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd]"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <DeleteHotelButton id={hotel.id} name={hotel.name} />
        </div>
      </div>

      <div className="paraiso-card rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#eef4f4] text-[#12343b]">
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#11272b]">{hotel.name}</h1>
            <p className="text-[#5e7279]">{typeLabels[hotel.type]}</p>
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
            <span className="text-xs font-medium uppercase tracking-wide text-[#8a9ba1]">Notes</span>
            <p className="mt-1 whitespace-pre-wrap text-[#5e7279]">{hotel.notes}</p>
          </div>
        )}

        {hasBanking && (
          <div className="mt-8 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#11272b]">
              <Landmark className="h-4 w-4 text-[#8a9ba1]" />
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

      {/* Meal Plans — only for hotel type */}
      {hotel.type === "hotel" && (
        <div className="paraiso-card rounded-2xl p-6">
          <MealPlanManager
            hotelId={hotel.id}
            hotelCurrency={hotel.currency}
            initialMealPlans={mealPlans}
          />
        </div>
      )}
    </div>
  );
}
