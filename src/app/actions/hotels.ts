"use server";

import { revalidatePath } from "next/cache";
import {
  createHotel,
  updateHotel,
  updatePackage,
  deleteHotel,
  getPackages,
  getPayments,
  getHotel,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import type { PackageOption, TourPackage } from "@/lib/types";
import { requireAdmin } from "@/lib/admin-session";

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

/**
 * Strip every option referencing `supplierId` out of a package's curated
 * lists (top-level option groups + per-day accommodation options).
 *
 * Called from `deleteHotelAction` when archiving a supplier so leftover
 * `PackageOption` rows don't keep pointing at a supplier that no longer
 * appears in the live catalog. We preserve hand-typed entries (no
 * `supplierId`) and any options pointing at OTHER suppliers — only the
 * exact archived id is removed.
 *
 * Returns null when no changes are needed, otherwise a partial update
 * payload ready to hand to `updatePackage`.
 */
function buildSupplierCleanupPatch(
  pkg: TourPackage,
  supplierId: string,
): Partial<TourPackage> | null {
  const stripGroup = (options: PackageOption[] | undefined) =>
    (options ?? []).filter((opt) => opt.supplierId !== supplierId);

  const accommodationOptions = stripGroup(pkg.accommodationOptions);
  const transportOptions = stripGroup(pkg.transportOptions);
  const mealOptions = stripGroup(pkg.mealOptions);
  const customOptions = stripGroup(pkg.customOptions);

  const itinerary = (pkg.itinerary ?? []).map((day) => ({
    ...day,
    accommodationOptions: stripGroup(day.accommodationOptions),
  }));

  const changed =
    accommodationOptions.length !== (pkg.accommodationOptions ?? []).length ||
    transportOptions.length !== (pkg.transportOptions ?? []).length ||
    mealOptions.length !== (pkg.mealOptions ?? []).length ||
    customOptions.length !== (pkg.customOptions ?? []).length ||
    (pkg.itinerary ?? []).some(
      (day, idx) =>
        (day.accommodationOptions ?? []).length !==
        (itinerary[idx]?.accommodationOptions ?? []).length,
    );

  if (!changed) return null;

  return {
    accommodationOptions,
    transportOptions,
    mealOptions,
    customOptions,
    itinerary,
  };
}

export async function createHotelAction(formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string)?.trim();
  const type = (formData.get("type") as string) || "hotel";
  const location = (formData.get("location") as string)?.trim() || undefined;
  const contact = (formData.get("contact") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const defaultPricePerNight = parseOptionalNum(formData.get("defaultPricePerNight") as string);
  const maxConcurrentBookings = parseOptionalNum(formData.get("maxConcurrentBookings") as string);
  const starRating = parseOptionalNum(formData.get("starRating") as string);
  const capacity = parseOptionalNum(formData.get("capacity") as string);
  const currency = (formData.get("currency") as string) || "USD";
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const bankName = (formData.get("bankName") as string)?.trim() || undefined;
  const bankBranch = (formData.get("bankBranch") as string)?.trim() || undefined;
  const accountName = (formData.get("accountName") as string)?.trim() || undefined;
  const accountNumber = (formData.get("accountNumber") as string)?.trim() || undefined;
  const swiftCode = (formData.get("swiftCode") as string)?.trim() || undefined;
  const bankCurrency = (formData.get("bankCurrency") as string)?.trim() || undefined;
  const paymentReference = (formData.get("paymentReference") as string)?.trim() || undefined;
  const destinationId = (formData.get("destinationId") as string)?.trim() || undefined;

  if (!name) return { error: "Name is required" };

  const hotel = await createHotel({
    name,
    type: type as "hotel" | "transport" | "meal" | "supplier",
    location,
    destinationId,
    contact,
    email,
    defaultPricePerNight,
    maxConcurrentBookings,
    starRating: type === "hotel" && starRating ? starRating : undefined,
    capacity: type === "transport" ? capacity : undefined,
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
  // /admin/transportation lists type==="transport" rows separately from
  // /admin/hotels — keep both surfaces fresh on create.
  if (hotel.type === "transport") revalidatePath("/admin/transportation");
  // Guest-facing journey-builder consumes the hotel/transport/meal
  // catalog through getHotels(); without this, a newly-saved hotel
  // (e.g. "Palace, Colombo") wouldn't appear in the destination picker
  // until the next deploy.
  revalidatePath("/journey-builder");
  // Destination cards count hotels per destinationId — bust the cache
  // so the new row bumps the count immediately.
  revalidatePath("/admin/destinations");
  if (hotel.destinationId) revalidatePath(`/admin/destinations/${hotel.destinationId}`);
  return { success: true, id: hotel.id };
}

export async function updateHotelAction(id: string, formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string)?.trim();
  const type = (formData.get("type") as string) || "hotel";
  const location = (formData.get("location") as string)?.trim() || undefined;
  const contact = (formData.get("contact") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const defaultPricePerNight = parseOptionalNum(formData.get("defaultPricePerNight") as string);
  const maxConcurrentBookings = parseOptionalNum(formData.get("maxConcurrentBookings") as string);
  const starRating = parseOptionalNum(formData.get("starRating") as string);
  const capacity = parseOptionalNum(formData.get("capacity") as string);
  const currency = (formData.get("currency") as string) || "USD";
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const bankName = (formData.get("bankName") as string)?.trim() || undefined;
  const bankBranch = (formData.get("bankBranch") as string)?.trim() || undefined;
  const accountName = (formData.get("accountName") as string)?.trim() || undefined;
  const accountNumber = (formData.get("accountNumber") as string)?.trim() || undefined;
  const swiftCode = (formData.get("swiftCode") as string)?.trim() || undefined;
  const bankCurrency = (formData.get("bankCurrency") as string)?.trim() || undefined;
  const paymentReference = (formData.get("paymentReference") as string)?.trim() || undefined;
  const destinationId = (formData.get("destinationId") as string)?.trim() || undefined;

  if (!name) return { error: "Name is required" };

  const updated = await updateHotel(id, {
    name,
    type: type as "hotel" | "transport" | "meal" | "supplier",
    location,
    destinationId,
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
  if (updated.type === "transport") revalidatePath("/admin/transportation");
  revalidatePath("/journey-builder");
  // Refresh the destination overview cards + the detail page for both
  // the previous AND new destinationId so a re-assignment (Colombo →
  // Kandy) clears the old card and populates the new one in one save.
  revalidatePath("/admin/destinations");
  if (updated.destinationId) revalidatePath(`/admin/destinations/${updated.destinationId}`);
  return { success: true };
}

export async function deleteHotelAction(id: string) {
  await requireAdmin();
  const hotel = await getHotel(id);
  const [packages, payments] = await Promise.all([getPackages(), getPayments()]);

  // Archive is a SOFT operation: we set `archivedAt`, keep the supplier row
  // for FK resolution (payment history, lead snapshots), and let the live
  // resolvers (`resolvePackageTransportFromCatalog`, `getCustomJourney*Options`)
  // hide the supplier from booking surfaces. Package option references with
  // matching `supplierId` are stale labels — we strip them in-place rather
  // than blocking the archive.
  const affectedPackages = packages.filter((pkg) => packageUsesSupplier(pkg, id));

  let cleanedPackageNames: string[] = [];
  for (const pkg of affectedPackages) {
    const patch = buildSupplierCleanupPatch(pkg, id);
    if (!patch) continue;
    const updated = await updatePackage(pkg.id, patch);
    if (updated) cleanedPackageNames.push(updated.name);
  }

  const ok = await deleteHotel(id);
  if (!ok) {
    return {
      error:
        "Supplier could not be archived. It may still be referenced elsewhere.",
    };
  }

  if (hotel) {
    const details: string[] = [];
    if (cleanedPackageNames.length > 0) {
      const shown = cleanedPackageNames.slice(0, 5).join(", ");
      const more =
        cleanedPackageNames.length > 5
          ? ` (+${cleanedPackageNames.length - 5} more)`
          : "";
      details.push(
        `Removed from ${cleanedPackageNames.length} package${
          cleanedPackageNames.length === 1 ? "" : "s"
        }: ${shown}${more}`,
      );
    }
    if (payments.some((payment) => payment.supplierId === id)) {
      details.push(
        "Existing payment history retained — archived row preserved for finance lookups.",
      );
    }
    await recordAuditEvent({
      entityType: "supplier",
      entityId: hotel.id,
      action: "archived",
      summary: `${hotel.type === "hotel" ? "Hotel" : "Supplier"} archived: ${hotel.name}`,
      details: details.length > 0 ? details : undefined,
    });
  }

  revalidatePath("/admin/hotels");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payables");
  if (hotel?.type === "transport") revalidatePath("/admin/transportation");
  revalidatePath("/journey-builder");
  // Archived hotels disappear from the destination card counts —
  // refresh so the count drops immediately.
  revalidatePath("/admin/destinations");
  if (hotel?.destinationId) revalidatePath(`/admin/destinations/${hotel.destinationId}`);
  return {
    success: true,
    cleanedPackages: cleanedPackageNames.length,
  };
}
