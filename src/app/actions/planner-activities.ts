"use server";

import { revalidatePath } from "next/cache";
import {
  createPlannerActivity,
  updatePlannerActivity,
  deletePlannerActivity,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";

export async function createActivityAction(formData: FormData) {
  const destinationId = (formData.get("destinationId") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const summary = (formData.get("summary") as string)?.trim();
  const durationLabel =
    (formData.get("durationLabel") as string)?.trim() || "2 hours";
  const energy = (formData.get("energy") as string) || "easy";
  const bestFor =
    (formData.get("bestFor") as string)?.trim() || undefined;
  const estimatedPrice =
    parseFloat(formData.get("estimatedPrice") as string) || 0;
  const tagsRaw = (formData.get("tags") as string)?.trim() || "";
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  if (!destinationId || !title || !summary)
    return { error: "Destination, title, and summary are required." };

  const record = await createPlannerActivity({
    destinationId,
    title,
    summary,
    durationLabel,
    energy: energy as "easy" | "moderate" | "active",
    bestFor,
    estimatedPrice,
    tags,
  });

  await recordAuditEvent({
    entityType: "activity",
    entityId: record.id,
    action: "created",
    summary: `Activity created: ${title} (${destinationId})`,
  });

  revalidatePath("/admin/activities");
  return { success: true, id: record.id };
}

export async function updateActivityAction(id: string, formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const summary = (formData.get("summary") as string)?.trim();
  const durationLabel =
    (formData.get("durationLabel") as string)?.trim() || "2 hours";
  const energy = (formData.get("energy") as string) || "easy";
  const bestFor =
    (formData.get("bestFor") as string)?.trim() || undefined;
  const estimatedPrice =
    parseFloat(formData.get("estimatedPrice") as string) || 0;
  const tagsRaw = (formData.get("tags") as string)?.trim() || "";
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const destinationId = (formData.get("destinationId") as string)?.trim();

  if (!title || !summary)
    return { error: "Title and summary are required." };

  const ok = await updatePlannerActivity(id, {
    title,
    summary,
    durationLabel,
    energy: energy as "easy" | "moderate" | "active",
    bestFor,
    estimatedPrice,
    tags,
    ...(destinationId ? { destinationId } : {}),
  });

  if (!ok) return { error: "Failed to update activity." };

  revalidatePath("/admin/activities");
  return { success: true };
}

export async function deleteActivityAction(id: string) {
  const ok = await deletePlannerActivity(id);
  if (!ok) return { error: "Failed to archive activity." };
  revalidatePath("/admin/activities");
  return { success: true };
}
