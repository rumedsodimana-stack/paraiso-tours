"use server";

import { revalidatePath } from "next/cache";
import { createPackage, updatePackage, deletePackage } from "@/lib/db";
import type { ItineraryDay, PackageOption } from "@/lib/types";

function parseItinerary(formData: FormData): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  let i = 0;
  while (true) {
    const title = formData.get(`itinerary_${i}_title`) as string;
    const description = formData.get(`itinerary_${i}_description`) as string;
    const accommodation = formData.get(`itinerary_${i}_accommodation`) as string;
    if (!title && !description) break;
    days.push({
      day: i + 1,
      title: title?.trim() || "",
      description: description?.trim() || "",
      accommodation: accommodation?.trim() || undefined,
    });
    i++;
  }
  return days;
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

  const updated = await updatePackage(id, {
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
    accommodationOptions: accommodationOptions.length ? accommodationOptions : undefined,
    customOptions: customOptions.length ? customOptions : undefined,
  });

  if (!updated) return { error: "Package not found" };

  revalidatePath("/admin/packages");
  revalidatePath(`/admin/packages/${id}`);
  revalidatePath("/");
  return { success: true };
}

export async function deletePackageAction(id: string) {
  const ok = await deletePackage(id);
  if (!ok) return { error: "Package not found" };

  revalidatePath("/admin/packages");
  revalidatePath("/");
  return { success: true };
}
