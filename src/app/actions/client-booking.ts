"use server";

import { revalidatePath } from "next/cache";
import { createLead } from "@/lib/db";
import { getPackage } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import {
  isWhatsAppConfigured,
  sendWhatsAppBookingConfirmation,
} from "@/lib/whatsapp";

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
  const selectedAccommodationByNightRaw = (formData.get("selectedAccommodationByNight") as string)?.trim();
  let selectedAccommodationByNight: Record<string, string> | undefined;
  if (selectedAccommodationByNightRaw) {
    try {
      const parsed = JSON.parse(selectedAccommodationByNightRaw);
      if (parsed && typeof parsed === "object")
        selectedAccommodationByNight = parsed as Record<string, string>;
    } catch {
      /* ignore */
    }
  }
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

  // Send WhatsApp confirmation if configured and client provided phone
  if (isWhatsAppConfigured() && lead.phone?.trim()) {
    sendWhatsAppBookingConfirmation({
      clientName: lead.name,
      phone: lead.phone,
      reference: lead.reference ?? lead.id,
      packageName: pkg.name,
    }).catch((err) => {
      debugLog("WhatsApp booking confirmation failed", {
        error: err instanceof Error ? err.message : String(err),
        leadId: lead.id,
      });
    });
  }

  return { success: true, leadId: lead.id, reference: lead.reference ?? undefined };
}
