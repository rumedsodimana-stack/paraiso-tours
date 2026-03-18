"use server";

import { revalidatePath } from "next/cache";
import { createTour, updateTour, deleteTour, getPackage, getLead } from "@/lib/db";
import type { TourStatus } from "@/lib/types";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createTourAction(formData: FormData) {
  const leadId = (formData.get("leadId") as string)?.trim();
  const packageId = (formData.get("packageId") as string)?.trim();
  const startDate = (formData.get("startDate") as string)?.trim();
  const pax = parseInt((formData.get("pax") as string) || "1", 10);

  if (!leadId || !packageId || !startDate) {
    return { error: "Lead, package, and start date are required" };
  }

  const pkg = await getPackage(packageId);
  if (!pkg) return { error: "Package not found" };

  const match = pkg.duration.match(/(\d+)\s*Days?/i);
  const days = match ? parseInt(match[1], 10) : 7;
  const endDate = addDays(startDate, days - 1);

  const totalValue = pkg.price * pax;

  const lead = await getLead(leadId);
  const clientName = lead?.name ?? (formData.get("clientName") as string) ?? "";

  const tour = await createTour({
    packageId,
    packageName: pkg.name,
    leadId,
    clientName,
    startDate,
    endDate,
    pax,
    status: "scheduled",
    totalValue,
    currency: pkg.currency,
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, id: tour.id };
}

export async function updateTourStatusAction(id: string, status: TourStatus) {
  const updated = await updateTour(id, { status });
  if (!updated) return { error: "Tour not found" };

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function deleteTourAction(id: string) {
  const ok = await deleteTour(id);
  if (!ok) return { error: "Tour not found" };

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}
