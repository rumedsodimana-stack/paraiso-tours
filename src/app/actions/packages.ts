"use server";

import { revalidatePath } from "next/cache";
import { createPackage, updatePackage, deletePackage } from "@/lib/db";
import type { ItineraryDay } from "@/lib/types";

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

export async function createPackageAction(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const duration = (formData.get("duration") as string)?.trim();
  const destination = (formData.get("destination") as string)?.trim();
  const price = parseFloat((formData.get("price") as string) || "0");
  const currency = (formData.get("currency") as string) || "USD";
  const description = (formData.get("description") as string)?.trim();

  if (!name || !destination) {
    return { error: "Name and destination are required" };
  }

  const itinerary = parseItinerary(formData);
  const inclusions = parseList(formData, "inclusions");
  const exclusions = parseList(formData, "exclusions");

  const pkg = await createPackage({
    name,
    duration: duration || `${itinerary.length} Days / ${Math.max(0, itinerary.length - 1)} Nights`,
    destination,
    price,
    currency,
    description: description || "",
    itinerary,
    inclusions,
    exclusions,
  });

  revalidatePath("/packages");
  revalidatePath("/");
  return { success: true, id: pkg.id };
}

export async function updatePackageAction(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const duration = (formData.get("duration") as string)?.trim();
  const destination = (formData.get("destination") as string)?.trim();
  const price = parseFloat((formData.get("price") as string) || "0");
  const currency = (formData.get("currency") as string) || "USD";
  const description = (formData.get("description") as string)?.trim();

  if (!name || !destination) {
    return { error: "Name and destination are required" };
  }

  const itinerary = parseItinerary(formData);
  const inclusions = parseList(formData, "inclusions");
  const exclusions = parseList(formData, "exclusions");

  const updated = await updatePackage(id, {
    name,
    duration: duration || `${itinerary.length} Days / ${Math.max(0, itinerary.length - 1)} Nights`,
    destination,
    price,
    currency,
    description: description || "",
    itinerary,
    inclusions,
    exclusions,
  });

  if (!updated) return { error: "Package not found" };

  revalidatePath("/packages");
  revalidatePath(`/packages/${id}`);
  revalidatePath("/");
  return { success: true };
}

export async function deletePackageAction(id: string) {
  const ok = await deletePackage(id);
  if (!ok) return { error: "Package not found" };

  revalidatePath("/packages");
  revalidatePath("/");
  return { success: true };
}
