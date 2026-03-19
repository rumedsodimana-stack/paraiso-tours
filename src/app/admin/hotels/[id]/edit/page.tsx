import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getHotel } from "@/lib/db";
import { HotelForm } from "../../HotelForm";
import { updateHotelAction } from "@/app/actions/hotels";
import { SaveSuccessBanner } from "../../../SaveSuccessBanner";
import { DeleteHotelButton } from "../../DeleteHotelButton";

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

  async function action(formData: FormData) {
    "use server";
    return updateHotelAction(id, formData);
  }

  return (
    <div className="space-y-6">
      {saved === "1" && <SaveSuccessBanner message="Saved successfully" />}
      <Link
        href={`/admin/hotels/${id}`}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to {hotel.name}
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Edit {hotel.name}</h1>
          <DeleteHotelButton id={hotel.id} name={hotel.name} />
        </div>
        <HotelForm hotel={hotel} action={action} />
      </div>
    </div>
  );
}
