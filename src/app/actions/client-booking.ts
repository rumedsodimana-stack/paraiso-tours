"use server";

import { revalidatePath } from "next/cache";
import { createLead } from "@/lib/db";
import { getPackage } from "@/lib/db";
import { debugLog } from "@/lib/debug";

export async function createClientBookingAction(
  packageId: string,
  formData: FormData
) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const travelDate = (formData.get("travelDate") as string)?.trim();
  const pax = formData.get("pax")
    ? parseInt(String(formData.get("pax")), 10)
    : undefined;
  const notes = (formData.get("notes") as string)?.trim();
  const selectedAccommodationOptionId = (formData.get("selectedAccommodationOptionId") as string)?.trim();
  const selectedTransportOptionId = (formData.get("selectedTransportOptionId") as string)?.trim();
  const selectedMealOptionId = (formData.get("selectedMealOptionId") as string)?.trim();
  const totalPrice = formData.get("totalPrice")
    ? parseFloat(String(formData.get("totalPrice")))
    : undefined;

  if (!name || !email) {
    return { error: "Name and email are required" };
  }

  const pkg = await getPackage(packageId);
  if (!pkg) {
    return { error: "Package not found" };
  }

  debugLog("createClientBooking", { packageId, pax, totalPrice });
  const lead = await createLead({
    name,
    email,
    phone: phone || "",
    source: "Client Portal",
    status: "new",
    destination: pkg.destination,
    travelDate: travelDate || undefined,
    pax: pax ?? 1,
    notes: notes || undefined,
    packageId: pkg.id,
    selectedAccommodationOptionId: selectedAccommodationOptionId || undefined,
    selectedTransportOptionId: selectedTransportOptionId || undefined,
    selectedMealOptionId: selectedMealOptionId || undefined,
    totalPrice: totalPrice,
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/");
  revalidatePath("/my-bookings");
  return { success: true, leadId: lead.id, reference: lead.reference ?? undefined };
}
