"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLead, updateLead, deleteLead, getLead } from "@/lib/db";
import type { LeadStatus } from "@/lib/types";

export async function createLeadAction(formData: FormData) {
  try {
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const source = (formData.get("source") as string) || "Manual";
    const status = (formData.get("status") as LeadStatus) || "new";
    const destination = (formData.get("destination") as string)?.trim();
    const travelDate = (formData.get("travelDate") as string)?.trim();
    const pax = formData.get("pax") ? parseInt(String(formData.get("pax")), 10) : undefined;
    const accompaniedGuestName = (formData.get("accompaniedGuestName") as string)?.trim();
    const notes = (formData.get("notes") as string)?.trim();
    const packageId = (formData.get("packageId") as string)?.trim() || undefined;

    if (!name || !email) {
      return { error: "Name and email are required" };
    }

    await createLead({
      name,
      email,
      phone: phone || "",
      source,
      status,
      destination: destination || undefined,
      travelDate: travelDate || undefined,
      pax,
      accompaniedGuestName: accompaniedGuestName || undefined,
      notes: notes || undefined,
      packageId,
    });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    revalidatePath("/");
    redirect("/admin/bookings?saved=1");
  } catch (err) {
    if (err instanceof Error && "digest" in err && String(err.message).includes("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("createLeadAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create booking. Please try again." };
  }
}

export async function updateLeadAction(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const source = (formData.get("source") as string) || "Manual";
  const status = (formData.get("status") as LeadStatus) || "new";
  const destination = (formData.get("destination") as string)?.trim();
  const travelDate = (formData.get("travelDate") as string)?.trim();
  const pax = formData.get("pax") ? parseInt(String(formData.get("pax")), 10) : undefined;
  const accompaniedGuestName = (formData.get("accompaniedGuestName") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim();
  const packageId = (formData.get("packageId") as string)?.trim() || undefined;

  if (!name || !email) {
    return { error: "Name and email are required" };
  }

  const existing = await getLead(id);
  if (!existing) return { error: "Lead not found" };
  const packageChanged = (existing.packageId ?? "") !== (packageId ?? "");

  const updated = await updateLead(id, {
    name,
    email,
    phone: phone || "",
    source,
    status,
    destination: destination || undefined,
    travelDate: travelDate || undefined,
    pax,
    accompaniedGuestName: accompaniedGuestName || undefined,
    notes: notes || undefined,
    packageId,
    ...(packageChanged
      ? {
          selectedAccommodationOptionId: undefined,
          selectedAccommodationByNight: undefined,
          selectedTransportOptionId: undefined,
          selectedMealOptionId: undefined,
          totalPrice: undefined,
        }
      : {}),
  });

  if (!updated) return { error: "Lead not found" };

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateLeadStatusAction(id: string, status: LeadStatus) {
  const updated = await updateLead(id, { status });
  if (!updated) return { error: "Lead not found" };

  revalidatePath("/admin/bookings");
  revalidatePath("/");
  return { success: true };
}

export async function deleteLeadAction(id: string) {
  const ok = await deleteLead(id);
  if (!ok) return { error: "Lead not found" };

  revalidatePath("/admin/bookings");
  revalidatePath("/");
  return { success: true };
}
