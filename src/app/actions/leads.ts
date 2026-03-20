"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLead, updateLead, deleteLead, getLead, getPackage } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { createPackageSnapshot } from "@/lib/package-snapshot";
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

    let packageSnapshot;
    if (packageId) {
      const pkg = await getPackage(packageId);
      if (!pkg) {
        return { error: "Package not found" };
      }
      packageSnapshot = createPackageSnapshot({ pkg });
    }

    const lead = await createLead({
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
      packageSnapshot,
    });

    await recordAuditEvent({
      entityType: "lead",
      entityId: lead.id,
      action: "created",
      summary: `Booking created for ${lead.name}`,
      details: [
        `Source: ${source}`,
        `Status: ${status}`,
        packageId ? `Package linked: ${packageId}` : "No package linked yet",
      ],
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
  let packageSnapshot = existing.packageSnapshot;

  if (packageId) {
    const pkg = await getPackage(packageId);
    if (!pkg) {
      return { error: "Package not found" };
    }
    if (packageChanged || !existing.packageSnapshot) {
      packageSnapshot = createPackageSnapshot({
        pkg,
        selectedAccommodationOptionId: packageChanged
          ? undefined
          : existing.selectedAccommodationOptionId,
        selectedAccommodationByNight: packageChanged
          ? undefined
          : existing.selectedAccommodationByNight,
        selectedTransportOptionId: packageChanged
          ? undefined
          : existing.selectedTransportOptionId,
        selectedMealOptionId: packageChanged
          ? undefined
          : existing.selectedMealOptionId,
        totalPrice: packageChanged ? undefined : existing.totalPrice,
      });
    }
  } else {
    packageSnapshot = undefined;
  }

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
    packageSnapshot,
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

  await recordAuditEvent({
    entityType: "lead",
    entityId: updated.id,
    action: "updated",
    summary: `Booking updated for ${updated.name}`,
    details: [
      `Status: ${updated.status}`,
      updated.travelDate ? `Travel date: ${updated.travelDate}` : "Travel date cleared",
      updated.packageId ? `Package: ${updated.packageId}` : "No package linked",
    ],
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateLeadStatusAction(id: string, status: LeadStatus) {
  const updated = await updateLead(id, { status });
  if (!updated) return { error: "Lead not found" };

  await recordAuditEvent({
    entityType: "lead",
    entityId: updated.id,
    action: "status_changed",
    summary: `Booking status changed to ${status}`,
    details: [`Client: ${updated.name}`],
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/");
  return { success: true };
}

export async function deleteLeadAction(id: string) {
  const lead = await getLead(id);
  const ok = await deleteLead(id);
  if (!ok) return { error: "Lead not found" };

  if (lead) {
    await recordAuditEvent({
      entityType: "lead",
      entityId: lead.id,
      action: "archived",
      summary: `Booking archived for ${lead.name}`,
    });
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/");
  return { success: true };
}
