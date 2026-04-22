"use server";

import { revalidatePath } from "next/cache";
import {
  createHotelMealPlan,
  updateHotelMealPlan,
  deleteHotelMealPlan,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-session";

export async function createMealPlanAction(formData: FormData) {
  await requireAdmin();
  const hotelId = (formData.get("hotelId") as string)?.trim();
  const label = (formData.get("label") as string)?.trim();
  const pricePerPerson =
    parseFloat(formData.get("pricePerPerson") as string) || 0;
  const priceType = (formData.get("priceType") as string) || "per_person";
  const currency = (formData.get("currency") as string) || "USD";
  const description =
    (formData.get("description") as string)?.trim() || undefined;

  if (!hotelId || !label)
    return { error: "Hotel and label are required." };

  const record = await createHotelMealPlan({
    hotelId,
    label,
    pricePerPerson,
    priceType,
    currency,
    description,
  });

  await recordAuditEvent({
    entityType: "meal_plan",
    entityId: record.id,
    action: "created",
    summary: `Meal plan created: ${label} for hotel ${hotelId}`,
  });

  revalidatePath(`/admin/hotels/${hotelId}`);
  return { success: true, id: record.id };
}

export async function updateMealPlanAction(id: string, formData: FormData) {
  await requireAdmin();
  const label = (formData.get("label") as string)?.trim();
  const pricePerPerson =
    parseFloat(formData.get("pricePerPerson") as string) || 0;
  const priceType = (formData.get("priceType") as string) || "per_person";
  const currency = (formData.get("currency") as string) || "USD";
  const description =
    (formData.get("description") as string)?.trim() || undefined;
  const hotelId = (formData.get("hotelId") as string)?.trim();

  if (!label) return { error: "Label is required." };

  const ok = await updateHotelMealPlan(id, {
    label,
    pricePerPerson,
    priceType,
    currency,
    description,
  });
  if (!ok) return { error: "Failed to update meal plan." };

  if (hotelId) revalidatePath(`/admin/hotels/${hotelId}`);
  revalidatePath("/admin/hotels");
  return { success: true };
}

export async function deleteMealPlanAction(id: string, hotelId: string) {
  await requireAdmin();
  const ok = await deleteHotelMealPlan(id);
  if (!ok) return { error: "Failed to archive meal plan." };

  revalidatePath(`/admin/hotels/${hotelId}`);
  return { success: true };
}
