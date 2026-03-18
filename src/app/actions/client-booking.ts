"use server";

import { revalidatePath } from "next/cache";
import { createLead } from "@/lib/db";
import { getPackage } from "@/lib/db";

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

  if (!name || !email) {
    return { error: "Name and email are required" };
  }

  const pkg = await getPackage(packageId);
  if (!pkg) {
    return { error: "Package not found" };
  }

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
  });

  revalidatePath("/leads");
  revalidatePath("/");
  revalidatePath("/client");
  revalidatePath("/client/my-bookings");
  return { success: true, leadId: lead.id, reference: lead.reference ?? undefined };
}
