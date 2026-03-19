"use server";

import { revalidatePath } from "next/cache";
import {
  createTour,
  updateTour,
  deleteTour,
  getTour,
  getPackage,
  getLead,
  getInvoice,
  getHotels,
  createTodo,
  createPayment,
  getPaymentByTourId,
  updatePayment,
  getInvoiceByLeadId,
  updateInvoice,
} from "@/lib/db";
import { createInvoiceFromLead } from "@/app/actions/invoices";
import { getSuppliersForSchedule } from "@/lib/booking-breakdown";
import { debugLog } from "@/lib/debug";
import {
  sendTourConfirmationWithInvoice,
  sendSupplierReservationEmail,
  sendPaymentReceiptEmail,
} from "@/lib/email";
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

  revalidatePath("/admin/calendar");
  revalidatePath("/");
  return { success: true, id: tour.id };
}

export async function updateTourStatusAction(id: string, status: TourStatus) {
  const updated = await updateTour(id, { status });
  if (!updated) return { error: "Tour not found" };

  revalidatePath("/admin/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function deleteTourAction(id: string) {
  const ok = await deleteTour(id);
  if (!ok) return { error: "Tour not found" };

  revalidatePath("/admin/calendar");
  revalidatePath("/");
  return { success: true };
}

/** Schedule a tour directly from a booking, using its package, travel date, pax, and client name.
 * Creates a transaction (Payment) with status "completed" if guestPaidOnline, else "pending". */
export async function scheduleTourFromLeadAction(
  leadId: string,
  startDate?: string,
  guestPaidOnline?: boolean
): Promise<{ id?: string; error?: string }> {
  try {
  const lead = await getLead(leadId);
  if (!lead) return { error: "Booking not found" };
  if (!lead.packageId) return { error: "Booking has no package selected. Edit the booking to add a package." };

  const pkg = await getPackage(lead.packageId);
  if (!pkg) return { error: "Package not found" };

  const date = startDate?.trim() || lead.travelDate?.trim();
  if (!date) return { error: "Travel date is required. Edit the booking to set a travel date, or provide it below." };

  const pax = lead.pax ?? 1;
  const match = pkg.duration.match(/(\d+)\s*Days?/i);
  const days = match ? parseInt(match[1], 10) : 7;
  const endDate = addDays(date, days - 1);
  const totalValue = pkg.price * pax;

  const tour = await createTour({
    packageId: pkg.id,
    packageName: pkg.name,
    leadId: lead.id,
    clientName: lead.name,
    startDate: date,
    endDate,
    pax,
    status: "scheduled",
    totalValue,
    currency: pkg.currency,
  });

  const reference = lead.reference ?? tour.id;
  const clientName = lead.name ?? "Client";

  // 1. Ensure invoice exists and send confirmation email with PDF
  let invoice = null;
  const invResult = await createInvoiceFromLead(leadId);
  if (invResult.success && invResult.invoiceId) {
    invoice = await getInvoice(invResult.invoiceId);
  }
  if (lead.email?.trim()) {
    sendTourConfirmationWithInvoice({
      clientName: lead.name,
      clientEmail: lead.email,
      packageName: pkg.name,
      startDate: date,
      endDate,
      pax,
      reference,
      invoice: invoice ?? undefined,
    }).catch((err) => {
      debugLog("Tour confirmation email failed", {
        error: err instanceof Error ? err.message : String(err),
        leadId: lead.id,
      });
    });
  }

  // 2. Send reservation emails to suppliers with email; create todos for those without
  const suppliers = await getHotels();
  const scheduleSuppliers = getSuppliersForSchedule(lead, pkg, suppliers);
  if (scheduleSuppliers) {
    for (const s of scheduleSuppliers.withEmail) {
      sendSupplierReservationEmail({
        supplierEmail: s.email,
        supplierName: s.supplierName,
        supplierType: s.supplierType as "Accommodation" | "Transport" | "Meals",
        clientName,
        accompaniedGuestName: lead.accompaniedGuestName,
        reference,
        packageName: pkg.name,
        optionLabel: s.optionLabel || "As per package",
        checkInDate: date,
        checkOutDate: endDate,
        pax,
        duration: pkg.duration,
      }).catch((err) => {
        debugLog("Supplier reservation email failed", {
          error: err instanceof Error ? err.message : String(err),
          supplier: s.supplierName,
          leadId: lead.id,
        });
      });
    }
    for (const m of scheduleSuppliers.missing) {
      await createTodo({
        title: `Contact ${m.supplierName} (${m.supplierType}) for ${clientName} - reservation confirmation ${reference}`,
        completed: false,
      });
    }
  }

  // 3. Create transaction (Payment) linked to tour for payments page
  await createPayment({
    type: "incoming",
    amount: totalValue,
    currency: pkg.currency,
    description: `Tour: ${pkg.name} – ${clientName}`,
    clientName: lead.name,
    reference,
    leadId: lead.id,
    tourId: tour.id,
    invoiceId: invoice?.id,
    status: guestPaidOnline ? "completed" : "pending",
    date: new Date().toISOString().slice(0, 10),
  });

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/todos");
  revalidatePath("/admin/bookings");
  revalidatePath("/");
  return { id: tour.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

/** Mark tour as completed & paid: update tour status, payment status, invoice status, send receipt email. */
export async function markTourCompletedPaidAction(
  tourId: string
): Promise<{ success?: boolean; paymentId?: string; error?: string }> {
  try {
    const tour = await getTour(tourId);
    if (!tour) return { error: "Tour not found" };
    if (tour.status === "completed") return { error: "Tour is already completed" };

    const lead = await getLead(tour.leadId);
    if (!lead) return { error: "Lead not found" };

    let payment = await getPaymentByTourId(tourId);
    if (!payment) {
      payment = await createPayment({
        type: "incoming",
        amount: tour.totalValue,
        currency: tour.currency,
        description: `Tour: ${tour.packageName} – ${lead.name}`,
        clientName: lead.name,
        reference: lead.reference,
        leadId: lead.id,
        tourId: tour.id,
        status: "completed",
        date: new Date().toISOString().slice(0, 10),
      });
    } else {
      await updatePayment(payment.id, { status: "completed" });
    }

    await updateTour(tourId, { status: "completed" });

    const invoice = await getInvoiceByLeadId(lead.id);
    if (invoice) {
      await updateInvoice(invoice.id, { status: "paid", paidAt: new Date().toISOString().slice(0, 10) });
    }

    if (lead.email?.trim()) {
      sendPaymentReceiptEmail({
        clientEmail: lead.email,
        clientName: lead.name,
        amount: tour.totalValue,
        currency: tour.currency,
        description: payment.description,
        reference: lead.reference,
        date: payment.date,
      }).catch((err) => {
        debugLog("Payment receipt email failed", {
          error: err instanceof Error ? err.message : String(err),
          tourId,
        });
      });
    }

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/payments");
    revalidatePath(`/admin/tours/${tourId}`);
    revalidatePath("/");
    return { success: true, paymentId: payment.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}
