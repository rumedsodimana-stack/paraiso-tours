import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getHotel } from "@/lib/db";
import { HotelForm } from "../HotelForm";
import { updateHotelAction } from "@/app/actions/hotels";

export default async function EditHotelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotel = await getHotel(id);
  if (!hotel) notFound();

  async function action(formData: FormData) {
    "use server";
    return updateHotelAction(id, formData);
  }

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
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Edit {hotel.name}</h1>
        <HotelForm hotel={hotel} action={action} />
      </div>
    </div>
  );
}
