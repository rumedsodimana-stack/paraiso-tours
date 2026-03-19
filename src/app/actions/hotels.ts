"use server";

import { revalidatePath } from "next/cache";
import { createHotel, updateHotel, deleteHotel } from "@/lib/db";

function parseOptionalNum(val: string | null): number | undefined {
  if (!val?.trim()) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

export async function createHotelAction(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const type = (formData.get("type") as string) || "hotel";
  const location = (formData.get("location") as string)?.trim() || undefined;
  const contact = (formData.get("contact") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const defaultPricePerNight = parseOptionalNum(formData.get("defaultPricePerNight") as string);
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

  revalidatePath("/admin/hotels");
  revalidatePath(`/admin/hotels/${id}`);
  return { success: true };
}

export async function deleteHotelAction(id: string) {
  const ok = await deleteHotel(id);
  if (!ok) return { error: "Hotel not found" };
  revalidatePath("/admin/hotels");
  return { success: true };
}
