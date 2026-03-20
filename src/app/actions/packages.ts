"use server";

import { revalidatePath } from "next/cache";
import { createPackage, updatePackage, deletePackage, getPackage } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import type { ItineraryDay, PackageOption } from "@/lib/types";

function parseItinerary(formData: FormData): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  let i = 0;
  while (true) {
    const title = formData.get(`itinerary_${i}_title`) as string;
    const description = formData.get(`itinerary_${i}_description`) as string;
    const accommodation = formData.get(`itinerary_${i}_accommodation`) as string;
    const accommodationOptionsRaw = formData.get(`itinerary_${i}_accommodationOptions`) as string;
    if (!title && !description && !accommodationOptionsRaw) break;
    const accommodationOptions = parseOptionsFromJson(accommodationOptionsRaw);
    days.push({
      day: i + 1,
      title: title?.trim() || "",
      description: description?.trim() || "",
      accommodation: accommodation?.trim() || undefined,
      accommodationOptions: accommodationOptions.length ? accommodationOptions : undefined,
    });
    i++;
  }
  return days;
}

function parseOptionsFromJson(raw: string): PackageOption[] {
  if (!raw?.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((o: unknown) => o && typeof o === "object" && ((o as { label?: string }).label || (o as { supplierId?: string }).supplierId)) : [];
  } catch {
    return [];
  }
}

function parseList(formData: FormData, key: string): string[] {
  const val = formData.get(key) as string;
  if (!val?.trim()) return [];
  return val.split("\n").map((s) => s.trim()).filter(Boolean);
}

function parseOptionalNum(formData: FormData, key: string): number | undefined {
  const v = formData.get(key) as string;
  if (!v?.trim()) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function parseOptions(formData: FormData, key: string): PackageOption[] {
  const v = formData.get(key) as string;
  if (!v?.trim()) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.filter((o) => o && (o.label || o.supplierId)) : [];
  } catch {
    return [];
  }
}

export async function createPackageAction(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const duration = (formData.get("duration") as string)?.trim();
  const destination = (formData.get("destination") as string)?.trim();
  const region = (formData.get("region") as string)?.trim() || undefined;
  const price = parseFloat((formData.get("price") as string) || "0");
  const currency = (formData.get("currency") as string) || "USD";
  const description = (formData.get("description") as string)?.trim();
  const cancellationPolicy = (formData.get("cancellationPolicy") as string)?.trim() || undefined;
  const imageUrl = (formData.get("imageUrl") as string)?.trim() || undefined;
  const rating = parseOptionalNum(formData, "rating");
  const reviewCount = parseOptionalNum(formData, "reviewCount") ?? undefined;
  const featured = formData.get("featured") === "on";
  const published = formData.get("published") === "on";

  if (!name || !destination) {
    return { error: "Name and destination are required" };
  }

  const itinerary = parseItinerary(formData);
  const inclusions = parseList(formData, "inclusions");
  const exclusions = parseList(formData, "exclusions");
  const mealOptions = parseOptions(formData, "mealOptions");
  const transportOptions = parseOptions(formData, "transportOptions");
  const accommodationOptions = parseOptions(formData, "accommodationOptions");
  const customOptions = parseOptions(formData, "customOptions");

  const pkg = await createPackage({
    name,
    duration: duration || `${itinerary.length} Days / ${Math.max(0, itinerary.length - 1)} Nights`,
    destination,
    region,
    price,
    currency,
    description: description || "",
    itinerary,
    inclusions,
    exclusions,
    rating,
    reviewCount: reviewCount != null ? Math.floor(reviewCount) : undefined,
    featured,
    published: published !== false,
    cancellationPolicy,
    imageUrl,
    mealOptions: mealOptions.length ? mealOptions : undefined,
    transportOptions: transportOptions.length ? transportOptions : undefined,
    accommodationOptions: accommodationOptions.length ? accommodationOptions : undefined,
    customOptions: customOptions.length ? customOptions : undefined,
  });

  await recordAuditEvent({
    entityType: "package",
    entityId: pkg.id,
    action: "created",
    summary: `Package created: ${pkg.name}`,
    details: [
      `Duration: ${pkg.duration}`,
      `Destination: ${pkg.destination}`,
      `Base price: ${pkg.price} ${pkg.currency}`,
    ],
  });

  revalidatePath("/admin/packages");
  revalidatePath("/");
  return { success: true, id: pkg.id };
}

export async function updatePackageAction(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const duration = (formData.get("duration") as string)?.trim();
  const destination = (formData.get("destination") as string)?.trim();
  const region = (formData.get("region") as string)?.trim() || undefined;
  const price = parseFloat((formData.get("price") as string) || "0");
  const currency = (formData.get("currency") as string) || "USD";
  const description = (formData.get("description") as string)?.trim();
  const cancellationPolicy = (formData.get("cancellationPolicy") as string)?.trim() || undefined;
  const imageUrl = (formData.get("imageUrl") as string)?.trim() || undefined;
  const rating = parseOptionalNum(formData, "rating");
  const reviewCount = parseOptionalNum(formData, "reviewCount");
  const featured = formData.get("featured") === "on";
  const published = formData.get("published") === "on";

  if (!name || !destination) {
    return { error: "Name and destination are required" };
  }

  const itinerary = parseItinerary(formData);
  const inclusions = parseList(formData, "inclusions");
  const exclusions = parseList(formData, "exclusions");
  const mealOptions = parseOptions(formData, "mealOptions");
  const transportOptions = parseOptions(formData, "transportOptions");
  const accommodationOptions = parseOptions(formData, "accommodationOptions");
  const customOptions = parseOptions(formData, "customOptions");

  // PackageForm only sends per-day itinerary accommodation options, not package-level.
  // Preserve existing package-level accommodationOptions when form doesn't send them
  // so 5-day/4-night packages still show options for all 4 nights on the booking form.
  const existing = await getPackage(id);
  const updateData: Parameters<typeof updatePackage>[1] = {
    name,
    duration: duration || `${itinerary.length} Days / ${Math.max(0, itinerary.length - 1)} Nights`,
    destination,
    region,
    price,
    currency,
    description: description || "",
    itinerary,
    inclusions,
    exclusions,
    rating,
    reviewCount: reviewCount != null ? Math.floor(reviewCount) : undefined,
    featured,
    published,
    cancellationPolicy,
    imageUrl,
    mealOptions: mealOptions.length ? mealOptions : undefined,
    transportOptions: transportOptions.length ? transportOptions : undefined,
    customOptions: customOptions.length ? customOptions : undefined,
  };
  if (accommodationOptions.length > 0) {
    updateData.accommodationOptions = accommodationOptions;
  } else if (existing?.accommodationOptions?.length) {
    updateData.accommodationOptions = existing.accommodationOptions;
  }

  const updated = await updatePackage(id, updateData);

  if (!updated) return { error: "Package not found" };

  await recordAuditEvent({
    entityType: "package",
    entityId: updated.id,
    action: "updated",
    summary: `Package updated: ${updated.name}`,
    details: [
      `Duration: ${updated.duration}`,
      `Destination: ${updated.destination}`,
      `Base price: ${updated.price} ${updated.currency}`,
    ],
  });

  revalidatePath("/admin/packages");
  revalidatePath(`/admin/packages/${id}`);
  revalidatePath("/");
  return { success: true };
}

export async function deletePackageAction(id: string) {
  const pkg = await getPackage(id);
  const ok = await deletePackage(id);
  if (!ok) return { error: "Package not found" };

  if (pkg) {
    await recordAuditEvent({
      entityType: "package",
      entityId: pkg.id,
      action: "archived",
      summary: `Package archived: ${pkg.name}`,
    });
  }

  revalidatePath("/admin/packages");
  revalidatePath("/");
  return { success: true };
}
