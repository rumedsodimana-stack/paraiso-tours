import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getHotel, getHotelMealPlans } from "@/lib/db";
import { HotelForm } from "../../HotelForm";
import { updateHotelAction } from "@/app/actions/hotels";
import { SaveSuccessBanner } from "../../../SaveSuccessBanner";
import { DeleteHotelButton } from "../../DeleteHotelButton";
import { MealPlanManager } from "../MealPlanManager";

export default async function EditHotelPage({
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

  // Meal plans only exist on `hotel`-type suppliers. Skip the Supabase
  // round-trip for transport / meal-provider / generic suppliers where
  // the manager won't render anyway.
  const mealPlans =
    hotel.type === "hotel" ? await getHotelMealPlans(id) : [];

  async function action(formData: FormData) {
    "use server";
    return updateHotelAction(id, formData);
  }

  return (
    <div className="space-y-6">
      {saved === "1" && <SaveSuccessBanner message="Saved successfully" />}
      <Link
        href={`/admin/hotels/${id}`}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to {hotel.name}
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-xl font-semibold text-[#11272b]">Edit {hotel.name}</h1>
          <DeleteHotelButton id={hotel.id} name={hotel.name} />
        </div>
        <HotelForm hotel={hotel} action={action} />
      </div>

      {/* Meal plans live on the same edit surface so operators can set
          prices while updating the hotel. Only renders for hotel-type
          suppliers (transport / meal-provider / generic suppliers don't
          have attached meal plans). The manager handles its own CRUD via
          server actions and calls router.refresh() after each mutation. */}
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
