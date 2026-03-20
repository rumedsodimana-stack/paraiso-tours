"use server";

import { revalidatePath } from "next/cache";
import {
  createHotel,
  updateHotel,
  deleteHotel,
  getPackages,
  getPayments,
  getHotel,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import type { TourPackage } from "@/lib/types";

function parseOptionalNum(val: string | null): number | undefined {
  if (!val?.trim()) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

function packageUsesSupplier(pkg: TourPackage, supplierId: string): boolean {
  const optionGroups = [
    pkg.accommodationOptions ?? [],
    pkg.transportOptions ?? [],
    pkg.mealOptions ?? [],
    pkg.customOptions ?? [],
    ...(pkg.itinerary ?? []).map((day) => day.accommodationOptions ?? []),
  ];

  return optionGroups.some((options) =>
    options.some((option) => option.supplierId === supplierId)
  );
}

export async function createHotelAction(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const type = (formData.get("type") as string) || "hotel";
  const location = (formData.get("location") as string)?.trim() || undefined;
  const contact = (formData.get("contact") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const defaultPricePerNight = parseOptionalNum(formData.get("defaultPricePerNight") as string);
  const maxConcurrentBookings = parseOptionalNum(formData.get("maxConcurrentBookings") as string);
  const starRating = parseOptionalNum(formData.get("starRating") as string);
  const currency = (formData.get("currency") as string) || "USD";
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const bankName = (formData.get("bankName") as string)?.trim() || undefined;
  const bankBranch = (formData.get("bankBranch") as string)?.trim() || undefined;
  const accountName = (formData.get("accountName") as string)?.trim() || undefined;
  const accountNumber = (formData.get("accountNumber") as string)?.trim() || undefined;
  const swiftCode = (formData.get("swiftCode") as string)?.trim() || undefined;
  const bankCurrency = (formData.get("bankCurrency") as string)?.trim() || undefined;
  const paymentReference = (formData.get("paymentReference") as string)?.trim() || undefined;

  if (!name) return { error: "Name is required" };

  const hotel = await createHotel({
    name,
    type: type as "hotel" | "transport" | "meal" | "supplier",
    location,
    contact,
    email,
    defaultPricePerNight,
    maxConcurrentBookings,
    starRating: type === "hotel" && starRating ? starRating : undefined,
    currency,
    notes,
    bankName,
    bankBranch,
    accountName,
    accountNumber,
    swiftCode,
    bankCurrency,
    paymentReference,
  });

  await recordAuditEvent({
    entityType: "supplier",
    entityId: hotel.id,
    action: "created",
    summary: `${hotel.type === "hotel" ? "Hotel" : "Supplier"} created: ${hotel.name}`,
    details: [
      `Type: ${hotel.type}`,
      hotel.location ? `Location: ${hotel.location}` : "Location not set",
      hotel.defaultPricePerNight != null
        ? `Default rate: ${hotel.defaultPricePerNight} ${hotel.currency}`
        : "Default rate not set",
    ],
  });

  revalidatePath("/admin/hotels");
  return { success: true, id: hotel.id };
}

export async function updateHotelAction(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const type = (formData.get("type") as string) || "hotel";
  const location = (formData.get("location") as string)?.trim() || undefined;
  const contact = (formData.get("contact") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const defaultPricePerNight = parseOptionalNum(formData.get("defaultPricePerNight") as string);
  const maxConcurrentBookings = parseOptionalNum(formData.get("maxConcurrentBookings") as string);
  const starRating = parseOptionalNum(formData.get("starRating") as string);
  const currency = (formData.get("currency") as string) || "USD";
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const bankName = (formData.get("bankName") as string)?.trim() || undefined;
  const bankBranch = (formData.get("bankBranch") as string)?.trim() || undefined;
  const accountName = (formData.get("accountName") as string)?.trim() || undefined;
  const accountNumber = (formData.get("accountNumber") as string)?.trim() || undefined;
  const swiftCode = (formData.get("swiftCode") as string)?.trim() || undefined;
  const bankCurrency = (formData.get("bankCurrency") as string)?.trim() || undefined;
  const paymentReference = (formData.get("paymentReference") as string)?.trim() || undefined;

  if (!name) return { error: "Name is required" };

  const updated = await updateHotel(id, {
    name,
    type: type as "hotel" | "transport" | "meal" | "supplier",
    location,
    contact,
    email,
    defaultPricePerNight,
    maxConcurrentBookings,
    starRating: type === "hotel" ? (starRating ?? undefined) : undefined,
    currency,
    notes,
    bankName,
    bankBranch,
    accountName,
    accountNumber,
    swiftCode,
    bankCurrency,
    paymentReference,
  });

  if (!updated) return { error: "Hotel not found" };

  await recordAuditEvent({
    entityType: "supplier",
    entityId: updated.id,
    action: "updated",
    summary: `${updated.type === "hotel" ? "Hotel" : "Supplier"} updated: ${updated.name}`,
    details: [
      `Type: ${updated.type}`,
      updated.location ? `Location: ${updated.location}` : "Location not set",
      updated.maxConcurrentBookings != null
        ? `Concurrent capacity: ${updated.maxConcurrentBookings}`
        : "Concurrent capacity unlimited",
    ],
  });

  revalidatePath("/admin/hotels");
  revalidatePath(`/admin/hotels/${id}`);
  return { success: true };
}

export async function deleteHotelAction(id: string) {
  const hotel = await getHotel(id);
  const [packages, payments] = await Promise.all([getPackages(), getPayments()]);
  const blockingPackages = packages.filter((pkg) => packageUsesSupplier(pkg, id));
  const blockingPayments = payments.filter((payment) => payment.supplierId === id);

  if (blockingPackages.length > 0 || blockingPayments.length > 0) {
    const reasons: string[] = [];

    if (blockingPackages.length > 0) {
      const packageNames = blockingPackages
        .slice(0, 3)
        .map((pkg) => pkg.name)
        .join(", ");
      const morePackages =
        blockingPackages.length > 3
          ? ` and ${blockingPackages.length - 3} more`
          : "";
      reasons.push(
        `it is still used in ${blockingPackages.length} package${blockingPackages.length === 1 ? "" : "s"} (${packageNames}${morePackages}). Remove or replace it in those package options first.`
      );
    }

    if (blockingPayments.length > 0) {
      reasons.push(
        `it is linked to ${blockingPayments.length} payment${blockingPayments.length === 1 ? "" : "s"} in your finance history.`
      );
    }

    return { error: `Cannot archive this supplier because ${reasons.join(" ")}` };
  }

  const ok = await deleteHotel(id);
  if (!ok) {
    return {
      error:
        "Supplier could not be archived. It may still be referenced elsewhere.",
    };
  }

  if (hotel) {
    await recordAuditEvent({
      entityType: "supplier",
      entityId: hotel.id,
      action: "archived",
      summary: `${hotel.type === "hotel" ? "Hotel" : "Supplier"} archived: ${hotel.name}`,
    });
  }

  revalidatePath("/admin/hotels");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payables");
  return { success: true };
}
