"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createQuotation,
  updateQuotation,
  deleteQuotation,
  getQuotation,
  createLead,
  createPackage,
  createTour,
  createPayment,
  createInvoice,
  getInvoices,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import type { Quotation, QuotationLineItem, ItineraryDay } from "@/lib/types";

function generateInvoiceNumber(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `INV-${timestamp}-${rand}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseLineItems(formData: FormData): QuotationLineItem[] {
  const items: QuotationLineItem[] = [];
  let i = 0;
  while (formData.has(`lineItems[${i}][label]`)) {
    const label = (formData.get(`lineItems[${i}][label]`) as string)?.trim();
    const quantity = parseFloat((formData.get(`lineItems[${i}][quantity]`) as string) || "1");
    const unitPrice = parseFloat((formData.get(`lineItems[${i}][unitPrice]`) as string) || "0");
    const notes = (formData.get(`lineItems[${i}][notes]`) as string)?.trim() || undefined;
    const total = quantity * unitPrice;
    if (label) {
      items.push({
        id: `li_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        quantity,
        unitPrice,
        total,
        notes,
      });
    }
    i++;
  }
  return items;
}

function parseItinerary(formData: FormData): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  let i = 0;
  while (formData.has(`itinerary[${i}][title]`)) {
    const title = (formData.get(`itinerary[${i}][title]`) as string)?.trim();
    const description = (formData.get(`itinerary[${i}][description]`) as string)?.trim() || "";
    const accommodation = (formData.get(`itinerary[${i}][accommodation]`) as string)?.trim() || undefined;
    if (title) {
      days.push({ day: i + 1, title, description, accommodation });
    }
    i++;
  }
  return days;
}

function parseStringList(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createQuotationAction(formData: FormData) {
  try {
    const contactName = (formData.get("contactName") as string)?.trim();
    const contactEmail = (formData.get("contactEmail") as string)?.trim();
    if (!contactName || !contactEmail) {
      return { error: "Contact name and email are required" };
    }

    const lineItems = parseLineItems(formData);
    const discountAmount =
      parseFloat((formData.get("discountAmount") as string) || "0") || undefined;
    const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
    const totalAmount = Math.max(0, subtotal - (discountAmount ?? 0));

    const quotation = await createQuotation({
      companyName: (formData.get("companyName") as string)?.trim() || undefined,
      contactName,
      contactEmail,
      contactPhone: (formData.get("contactPhone") as string)?.trim() || undefined,
      travelDate: (formData.get("travelDate") as string)?.trim() || undefined,
      duration: (formData.get("duration") as string)?.trim() || undefined,
      pax: parseInt((formData.get("pax") as string) || "1", 10),
      destination: (formData.get("destination") as string)?.trim() || undefined,
      title: (formData.get("title") as string)?.trim() || undefined,
      itinerary: parseItinerary(formData),
      inclusions: parseStringList((formData.get("inclusions") as string) || ""),
      exclusions: parseStringList((formData.get("exclusions") as string) || ""),
      termsAndConditions: (formData.get("termsAndConditions") as string)?.trim() || undefined,
      notes: (formData.get("notes") as string)?.trim() || undefined,
      validUntil: (formData.get("validUntil") as string)?.trim() || undefined,
      lineItems,
      subtotal,
      discountAmount,
      totalAmount,
      currency: (formData.get("currency") as string) || "USD",
      status: "draft",
    });

    await recordAuditEvent({
      entityType: "lead",
      entityId: quotation.id,
      action: "created",
      summary: `Quotation ${quotation.reference} created for ${contactName}${quotation.companyName ? ` (${quotation.companyName})` : ""}`,
      details: [`Total: ${totalAmount} ${quotation.currency}`],
    });

    revalidatePath("/admin/quotations");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create quotation" };
  }
  redirect("/admin/quotations?saved=1");
}

export async function updateQuotationAction(id: string, formData: FormData) {
  try {
    const quotation = await getQuotation(id);
    if (!quotation) return { error: "Quotation not found" };
    if (quotation.status === "accepted") return { error: "Cannot edit an accepted quotation" };

    const lineItems = parseLineItems(formData);
    const discountAmount =
      parseFloat((formData.get("discountAmount") as string) || "0") || undefined;
    const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
    const totalAmount = Math.max(0, subtotal - (discountAmount ?? 0));

    await updateQuotation(id, {
      companyName: (formData.get("companyName") as string)?.trim() || undefined,
      contactName: (formData.get("contactName") as string)?.trim() || quotation.contactName,
      contactEmail: (formData.get("contactEmail") as string)?.trim() || quotation.contactEmail,
      contactPhone: (formData.get("contactPhone") as string)?.trim() || undefined,
      travelDate: (formData.get("travelDate") as string)?.trim() || undefined,
      duration: (formData.get("duration") as string)?.trim() || undefined,
      pax: parseInt((formData.get("pax") as string) || "1", 10),
      destination: (formData.get("destination") as string)?.trim() || undefined,
      title: (formData.get("title") as string)?.trim() || undefined,
      itinerary: parseItinerary(formData),
      inclusions: parseStringList((formData.get("inclusions") as string) || ""),
      exclusions: parseStringList((formData.get("exclusions") as string) || ""),
      termsAndConditions: (formData.get("termsAndConditions") as string)?.trim() || undefined,
      notes: (formData.get("notes") as string)?.trim() || undefined,
      validUntil: (formData.get("validUntil") as string)?.trim() || undefined,
      lineItems,
      subtotal,
      discountAmount,
      totalAmount,
      currency: (formData.get("currency") as string) || quotation.currency,
    });

    await recordAuditEvent({
      entityType: "lead",
      entityId: id,
      action: "updated",
      summary: `Quotation ${quotation.reference} updated`,
    });

    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${id}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update quotation" };
  }
  redirect(`/admin/quotations/${id}?saved=1`);
}

export async function markQuotationSentAction(id: string) {
  const quotation = await getQuotation(id);
  if (!quotation) return { error: "Quotation not found" };
  if (quotation.status === "accepted") return { error: "Quotation already accepted" };

  await updateQuotation(id, {
    status: "sent",
    sentAt: new Date().toISOString(),
  });

  await recordAuditEvent({
    entityType: "lead",
    entityId: id,
    action: "status_changed",
    summary: `Quotation ${quotation.reference} marked as sent to ${quotation.contactEmail}`,
  });

  revalidatePath("/admin/quotations");
  revalidatePath(`/admin/quotations/${id}`);
  return { success: true };
}

export async function markQuotationRejectedAction(id: string) {
  const quotation = await getQuotation(id);
  if (!quotation) return { error: "Quotation not found" };
  if (quotation.status === "accepted") return { error: "Quotation already accepted" };

  await updateQuotation(id, {
    status: "rejected",
    rejectedAt: new Date().toISOString(),
  });

  await recordAuditEvent({
    entityType: "lead",
    entityId: id,
    action: "status_changed",
    summary: `Quotation ${quotation.reference} rejected`,
    details: [`Client: ${quotation.contactName}`],
  });

  revalidatePath("/admin/quotations");
  revalidatePath(`/admin/quotations/${id}`);
  return { success: true };
}

/**
 * Accept a quotation: create a custom package, lead, tour, invoice, and payment.
 * The quotation's itinerary and pricing become the scheduled tour.
 */
export async function acceptQuotationAction(
  id: string,
  startDate?: string
): Promise<{ success?: boolean; tourId?: string; error?: string }> {
  try {
    const quotation = await getQuotation(id);
    if (!quotation) return { error: "Quotation not found" };
    if (quotation.status === "accepted") return { error: "Already accepted" };

    const travelDate = startDate || quotation.travelDate;
    if (!travelDate) {
      return { error: "Travel date is required to schedule the tour. Set it in the quotation or provide it here." };
    }

    const pax = quotation.pax || 1;
    const currency = quotation.currency || "USD";

    // Parse days from duration or itinerary
    const daysFromItinerary = quotation.itinerary.length || 1;
    const daysMatch = quotation.duration?.match(/(\d+)\s*(Night|Day)/i);
    const nights = daysMatch
      ? parseInt(daysMatch[1], 10) + (daysMatch[2].toLowerCase().startsWith("d") ? -1 : 0)
      : daysFromItinerary;
    const endDate = addDays(travelDate, Math.max(nights, 1));

    // 1. Create a custom package from the quotation data
    const pkg = await createPackage({
      name: quotation.title || `${quotation.contactName} — Custom Package`,
      duration: quotation.duration || `${nights} Nights`,
      destination: quotation.destination || "Sri Lanka",
      price: quotation.totalAmount,
      currency,
      description: `Custom corporate package for ${quotation.companyName || quotation.contactName}. Ref: ${quotation.reference}`,
      itinerary: quotation.itinerary,
      inclusions: quotation.inclusions ?? [],
      exclusions: quotation.exclusions ?? [],
      published: false,
      featured: false,
      cancellationPolicy: quotation.termsAndConditions || undefined,
    });

    // 2. Create a Lead (status: won, source: Quotation)
    const lead = await createLead({
      name: quotation.contactName,
      email: quotation.contactEmail,
      phone: quotation.contactPhone || "",
      source: "Quotation",
      status: "won",
      destination: quotation.destination,
      travelDate,
      pax,
      notes: [
        `Quotation ref: ${quotation.reference}`,
        quotation.companyName ? `Company: ${quotation.companyName}` : null,
        quotation.notes ? `Notes: ${quotation.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      packageId: pkg.id,
      totalPrice: quotation.totalAmount,
      packageSnapshot: {
        packageId: pkg.id,
        name: pkg.name,
        duration: pkg.duration,
        destination: pkg.destination,
        price: pkg.price,
        currency,
        description: pkg.description,
        itinerary: pkg.itinerary,
        inclusions: pkg.inclusions,
        exclusions: pkg.exclusions,
        cancellationPolicy: pkg.cancellationPolicy,
        mealOptions: [],
        transportOptions: [],
        accommodationOptions: [],
        customOptions: [],
        totalPrice: quotation.totalAmount,
        capturedAt: new Date().toISOString(),
      },
    });

    // 3. Create a Tour
    const tour = await createTour({
      packageId: pkg.id,
      packageName: pkg.name,
      leadId: lead.id,
      clientName: quotation.contactName,
      startDate: travelDate,
      endDate,
      pax,
      status: "scheduled",
      totalValue: quotation.totalAmount,
      currency,
      packageSnapshot: lead.packageSnapshot,
      availabilityStatus: "ready",
      availabilityWarnings: [],
    });

    // 4. Create an Invoice
    const invoiceLineItems = quotation.lineItems.map((li) => ({
      description: li.quantity !== 1 ? `${li.label} × ${li.quantity}` : li.label,
      amount: li.total,
    }));
    if (quotation.discountAmount) {
      invoiceLineItems.push({ description: "Discount", amount: -quotation.discountAmount });
    }

    // Generate unique invoice number
    let invoiceNumber = generateInvoiceNumber();
    const existingInvoices = await getInvoices();
    const existingNumbers = new Set(existingInvoices.map((i) => i.invoiceNumber));
    while (existingNumbers.has(invoiceNumber)) {
      invoiceNumber = generateInvoiceNumber();
    }

    const invoice = await createInvoice({
      leadId: lead.id,
      reference: quotation.reference,
      invoiceNumber,
      status: "pending_payment",
      clientName: quotation.contactName,
      clientEmail: quotation.contactEmail,
      clientPhone: quotation.contactPhone,
      packageName: pkg.name,
      travelDate,
      pax,
      baseAmount: quotation.subtotal,
      lineItems: invoiceLineItems,
      totalAmount: quotation.totalAmount,
      currency,
    });

    // 5. Create a Payment record
    await createPayment({
      type: "incoming",
      amount: quotation.totalAmount,
      currency,
      description: `Corporate Tour: ${pkg.name} – ${quotation.contactName}`,
      clientName: quotation.contactName,
      reference: quotation.reference,
      leadId: lead.id,
      tourId: tour.id,
      invoiceId: invoice.id,
      status: "pending",
      date: travelDate,
    });

    // 6. Update quotation status
    await updateQuotation(id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      leadId: lead.id,
      tourId: tour.id,
    });

    await recordAuditEvent({
      entityType: "tour",
      entityId: tour.id,
      action: "created",
      summary: `Tour scheduled from accepted quotation ${quotation.reference} for ${quotation.contactName}`,
      details: [
        `Company: ${quotation.companyName || "—"}`,
        `Dates: ${travelDate} to ${endDate}`,
        `Value: ${quotation.totalAmount} ${currency}`,
      ],
    });

    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${id}`);
    revalidatePath("/admin/tours");
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/payments");
    revalidatePath("/");

    return { success: true, tourId: tour.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to accept quotation" };
  }
}

export async function deleteQuotationAction(id: string) {
  const quotation = await getQuotation(id);
  if (!quotation) return { error: "Quotation not found" };
  if (quotation.status === "accepted") return { error: "Cannot delete an accepted quotation — the tour is already scheduled" };

  await deleteQuotation(id);

  await recordAuditEvent({
    entityType: "lead",
    entityId: id,
    action: "deleted",
    summary: `Quotation ${quotation.reference} deleted`,
    details: [`Client: ${quotation.contactName}`],
  });

  revalidatePath("/admin/quotations");
  return { success: true };
}
