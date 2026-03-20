"use server";

import { revalidatePath } from "next/cache";
import {
  createTour,
  updateTour,
  deleteTour,
  getTour,
  getTours,
  getPackage,
  getLead,
  updateLead,
  getInvoice,
  getHotels,
  getTodos,
  createTodo,
  deleteTodo,
  createPayment,
  getPaymentByTourId,
  updatePayment,
  deletePayment,
  getInvoiceByLeadId,
  updateInvoice,
  deleteInvoice,
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { createInvoiceFromLead } from "@/app/actions/invoices";
import { getLeadBookingFinancials } from "@/lib/booking-pricing";
import { getSuppliersForSchedule } from "@/lib/booking-breakdown";
import { assessTourAvailability } from "@/lib/tour-availability";
import { debugLog } from "@/lib/debug";
import {
  sendTourConfirmationWithInvoice,
  sendSupplierReservationEmail,
  sendPaymentReceiptEmail,
} from "@/lib/email";
import {
  createPackageSnapshotFromLead,
  resolveLeadPackage,
  resolveTourPackage,
} from "@/lib/package-snapshot";
import type { Lead, TourPackage, TourStatus } from "@/lib/types";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function toLeadRollbackData(lead: Lead) {
  return {
    status: lead.status,
    travelDate: lead.travelDate,
    packageSnapshot: lead.packageSnapshot,
  };
}

function toTourRollbackData(tour: NonNullable<Awaited<ReturnType<typeof getTour>>>) {
  return {
    packageId: tour.packageId,
    packageName: tour.packageName,
    leadId: tour.leadId,
    clientName: tour.clientName,
    startDate: tour.startDate,
    endDate: tour.endDate,
    pax: tour.pax,
    status: tour.status,
    totalValue: tour.totalValue,
    currency: tour.currency,
    packageSnapshot: tour.packageSnapshot,
    clientConfirmationSentAt: tour.clientConfirmationSentAt,
    supplierNotificationsSentAt: tour.supplierNotificationsSentAt,
    paymentReceiptSentAt: tour.paymentReceiptSentAt,
    availabilityStatus: tour.availabilityStatus,
    availabilityWarnings: tour.availabilityWarnings,
  };
}

export async function createTourAction(formData: FormData) {
  const leadId = (formData.get("leadId") as string)?.trim();
  const packageId = (formData.get("packageId") as string)?.trim();
  const startDate = (formData.get("startDate") as string)?.trim();
  const pax = parseInt((formData.get("pax") as string) || "1", 10);

  if (!leadId || !packageId || !startDate) {
    return { error: "Lead, package, and start date are required" };
  }

  const lead = await getLead(leadId);
  if (!lead) return { error: "Booking not found" };
  const livePackage = await getPackage(packageId);
  const pkg =
    lead.packageSnapshot?.packageId === packageId
      ? resolveLeadPackage(lead, livePackage)
      : livePackage;
  if (!pkg) return { error: "Package not found" };
  if (lead.packageId && lead.packageId !== packageId) {
    return {
      error:
        "Selected package differs from the booking. Edit the booking first so pricing and supplier details stay consistent.",
    };
  }

  await updateLead(leadId, {
    packageId,
    destination: pkg.destination,
    pax,
    travelDate: startDate,
  });

  const result = await scheduleTourFromLeadAction(leadId, startDate, false);
  if (result.error) return { error: result.error };
  return { success: true, id: result.id };
}

export async function updateTourStatusAction(id: string, status: TourStatus) {
  const existingTour = await getTour(id);
  if (!existingTour) return { error: "Tour not found" };

  const updated = await updateTour(id, { status });
  if (!updated) return { error: "Tour not found" };

  await recordAuditEvent({
    entityType: "tour",
    entityId: updated.id,
    action: "status_changed",
    summary: `Tour status changed to ${status}`,
    details: [
      `Client: ${updated.clientName}`,
      `Package: ${updated.packageName}`,
      `Previous status: ${existingTour.status}`,
    ],
  });

  revalidatePath("/admin/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function deleteTourAction(id: string) {
  const tour = await getTour(id);
  if (!tour) return { error: "Tour not found" };

  const ok = await deleteTour(id);
  if (!ok) return { error: "Tour not found" };

  await recordAuditEvent({
    entityType: "tour",
    entityId: id,
    action: "deleted",
    summary: `Tour deleted: ${tour.packageName}`,
    details: [
      `Client: ${tour.clientName}`,
      `Dates: ${tour.startDate} to ${tour.endDate}`,
    ],
  });

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
): Promise<{
  id?: string;
  error?: string;
  warnings?: string[];
  availabilityStatus?: "ready" | "attention_needed";
}> {
  let rollback: (() => Promise<void>) | null = null;

  try {
    let lead = await getLead(leadId);
    if (!lead) return { error: "Booking not found" };
    if (!lead.packageId) {
      return {
        error:
          "Booking has no package selected. Edit the booking to add a package.",
      };
    }

    const livePackage = await getPackage(lead.packageId);
    if (!lead.packageSnapshot && livePackage) {
      const packageSnapshot = createPackageSnapshotFromLead(lead, livePackage);
      const snappedLead = await updateLead(lead.id, { packageSnapshot });
      if (snappedLead) {
        lead = snappedLead;
      } else {
        lead = { ...lead, packageSnapshot };
      }
    }

    const pkg = resolveLeadPackage(lead, livePackage);
    if (!pkg) return { error: "Package not found" };

    const rollbackLeadId = lead.id;
    const originalLeadState = toLeadRollbackData(lead);
    let leadWasMutated = false;
    let tourWasMutated = false;
    let createdTourId: string | null = null;
    let createdInvoiceId: string | null = null;
    let createdPaymentId: string | null = null;
    const createdTodoIds: string[] = [];
    let rollbackApplied = false;

    const date = startDate?.trim() || lead.travelDate?.trim();
    if (!date) {
      return {
        error:
          "Travel date is required. Edit the booking to set a travel date, or provide it below.",
      };
    }

    rollback = async () => {
      if (rollbackApplied) return;
      rollbackApplied = true;

      await Promise.allSettled([
        ...createdTodoIds.map((todoId) => deleteTodo(todoId)),
        ...(createdPaymentId ? [deletePayment(createdPaymentId)] : []),
        ...(createdInvoiceId ? [deleteInvoice(createdInvoiceId)] : []),
        ...(createdTourId ? [deleteTour(createdTourId)] : []),
        ...(!createdTourId && tourWasMutated && existingTourSnapshot
          ? [updateTour(existingTourSnapshot.id, existingTourSnapshot.data)]
          : []),
        ...(leadWasMutated
          ? [updateLead(rollbackLeadId, originalLeadState)]
          : []),
      ]);
    };

    if (lead.status !== "won") {
      const updatedLead = await updateLead(lead.id, {
        status: "won",
        travelDate: date,
      });
      if (!updatedLead) {
        return { error: "Booking could not be updated for scheduling." };
      }
      lead = updatedLead;
      leadWasMutated = true;
    } else if (lead.travelDate !== date) {
      const updatedLead = await updateLead(lead.id, { travelDate: date });
      if (!updatedLead) {
        return { error: "Booking travel date could not be updated." };
      }
      lead = updatedLead;
      leadWasMutated = true;
    }

    const pax = lead.pax ?? 1;
    const match = pkg.duration.match(/(\d+)\s*Days?/i);
    const days = match ? parseInt(match[1], 10) : 7;
    const endDate = addDays(date, days - 1);
    const suppliers = await getHotels();
    const financials = getLeadBookingFinancials(lead, pkg, suppliers);
    const totalValue = financials.totalPrice;

    const allTours = await getTours();
    const existingTour = allTours.find(
      (tour) => tour.leadId === lead.id && tour.status !== "cancelled"
    );
    const existingTourSnapshot = existingTour
      ? {
          id: existingTour.id,
          data: toTourRollbackData(existingTour),
        }
      : null;

    const relatedLeadIds = [
      ...new Set(
        allTours
          .filter((tour) => tour.id !== existingTour?.id)
          .map((tour) => tour.leadId)
          .filter((id) => id !== lead.id)
      ),
    ];
    const relatedPackageIds = [
      ...new Set(
        allTours
          .filter((tour) => tour.id !== existingTour?.id && !tour.packageSnapshot)
          .map((tour) => tour.packageId)
          .filter((id) => id !== livePackage?.id)
      ),
    ];
    const [relatedLeads, relatedPackages] = await Promise.all([
      Promise.all(relatedLeadIds.map((id) => getLead(id))),
      Promise.all(relatedPackageIds.map((id) => getPackage(id))),
    ]);
    const leadsById = new Map<string, Lead>([[lead.id, lead]]);
    const packagesById = new Map<string, TourPackage>();
    if (livePackage) {
      packagesById.set(livePackage.id, livePackage);
    }
    for (const relatedLead of relatedLeads) {
      if (relatedLead) leadsById.set(relatedLead.id, relatedLead);
    }
    for (const relatedPackage of relatedPackages) {
      if (relatedPackage) packagesById.set(relatedPackage.id, relatedPackage);
    }

    const availability = assessTourAvailability({
      lead,
      pkg,
      suppliers,
      tours: allTours,
      startDate: date,
      endDate,
      currentTourId: existingTour?.id,
      getTourContext: (tour) => {
        const contextLead = leadsById.get(tour.leadId);
        const contextPackage = resolveTourPackage(
          tour,
          packagesById.get(tour.packageId) ?? null,
          contextLead
        );
        if (!contextLead || !contextPackage) return null;
        return { lead: contextLead, pkg: contextPackage };
      },
    });
    const availabilityStatus = availability.status ?? "ready";
    const availabilityWarnings = availability.warnings ?? [];

    let tour = existingTour;
    if (!tour) {
      tour = await createTour({
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
        packageSnapshot: lead.packageSnapshot,
        availabilityStatus,
        availabilityWarnings,
      });
      createdTourId = tour.id;
    }

    if (existingTour) {
      const needsUpdate =
        existingTour.packageId !== pkg.id ||
        existingTour.packageName !== pkg.name ||
        existingTour.clientName !== lead.name ||
        existingTour.startDate !== date ||
        existingTour.endDate !== endDate ||
        existingTour.pax !== pax ||
        existingTour.totalValue !== totalValue ||
        existingTour.currency !== pkg.currency ||
        JSON.stringify(existingTour.packageSnapshot ?? null) !==
          JSON.stringify(lead.packageSnapshot ?? null) ||
        existingTour.availabilityStatus !== availabilityStatus ||
        JSON.stringify(existingTour.availabilityWarnings ?? []) !==
          JSON.stringify(availabilityWarnings);

      if (needsUpdate) {
        const updatedTour = await updateTour(existingTour.id, {
          packageId: pkg.id,
          packageName: pkg.name,
          clientName: lead.name,
          startDate: date,
          endDate,
          pax,
          totalValue,
          currency: pkg.currency,
          packageSnapshot: lead.packageSnapshot,
          availabilityStatus,
          availabilityWarnings,
        });
        if (!updatedTour) {
          await rollback?.();
          await recordAuditEvent({
            entityType: "lead",
            entityId: lead.id,
            action: "schedule_failed",
            summary: "Tour scheduling failed and changes were rolled back",
            details: ["The existing scheduled tour could not be updated."],
          });
          return {
            error:
              "The existing tour could not be updated. No booking changes were saved.",
          };
        }
        tour = updatedTour;
        tourWasMutated = true;
      }
    }

    const reference = lead.reference ?? tour.id;
    const clientName = lead.name ?? "Client";

    let invoice = await getInvoiceByLeadId(leadId);
    if (!invoice) {
      const invResult = await createInvoiceFromLead(leadId);
      if (invResult.error) {
        await rollback?.();
        await recordAuditEvent({
          entityType: "lead",
          entityId: lead.id,
          action: "schedule_failed",
          summary: "Tour scheduling failed and changes were rolled back",
          details: [invResult.error],
        });
        return { error: invResult.error };
      }
      if (invResult.success && invResult.invoiceId) {
        if (invResult.created) {
          createdInvoiceId = invResult.invoiceId;
        }
        invoice = await getInvoice(invResult.invoiceId);
      }
    }
    if (!invoice) {
      await rollback?.();
      await recordAuditEvent({
        entityType: "lead",
        entityId: lead.id,
        action: "schedule_failed",
        summary: "Tour scheduling failed and changes were rolled back",
        details: [
          "Invoice could not be created for this booking. Fix the booking data and try again.",
        ],
      });
      return {
        error:
          "Invoice could not be created for this booking. Fix the booking data and try again.",
      };
    }

    let payment = await getPaymentByTourId(tour.id);
    if (!payment) {
      payment = await createPayment({
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
      createdPaymentId = payment.id;
    } else {
      const updatedPayment = await updatePayment(payment.id, {
        amount: totalValue,
        currency: pkg.currency,
        description: `Tour: ${pkg.name} – ${clientName}`,
        clientName: lead.name,
        reference,
        leadId: lead.id,
        invoiceId: invoice?.id,
        status:
          guestPaidOnline && payment.status !== "completed"
            ? "completed"
            : payment.status,
      });
      if (!updatedPayment) {
        await rollback?.();
        await recordAuditEvent({
          entityType: "lead",
          entityId: lead.id,
          action: "schedule_failed",
          summary: "Tour scheduling failed and changes were rolled back",
          details: ["The linked payment could not be updated."],
        });
        return {
          error:
            "The linked payment could not be updated. No booking changes were saved.",
        };
      }
      payment = updatedPayment;
    }

    await recordAuditEvent({
      entityType: "lead",
      entityId: lead.id,
      action: "tour_scheduled",
      summary: `Tour scheduled from booking for ${lead.name}`,
      details: [
        `Package: ${pkg.name}`,
        `Dates: ${date} to ${endDate}`,
        `Total: ${totalValue} ${pkg.currency}`,
      ],
    });

    await recordAuditEvent({
      entityType: "tour",
      entityId: tour.id,
      action: createdTourId ? "created" : "updated",
      summary: `Tour scheduled for ${clientName}`,
      details: [
        `Package: ${pkg.name}`,
        `Travel window: ${date} to ${endDate}`,
        `Availability: ${availabilityStatus.replace(/_/g, " ")}`,
      ],
    });

    await recordAuditEvent({
      entityType: "payment",
      entityId: payment.id,
      action: createdPaymentId ? "created" : "updated",
      summary: `Incoming payment ${createdPaymentId ? "created" : "updated"} for scheduled tour`,
      details: [
        `Amount: ${payment.amount} ${payment.currency}`,
        `Status: ${payment.status}`,
        `Reference: ${payment.reference ?? reference}`,
      ],
    });

    rollback = null;

    try {
      const scheduleSuppliers = getSuppliersForSchedule(lead, pkg, suppliers);
      const existingTodos = await getTodos();
      const existingTodoTitles = new Set(existingTodos.map((todo) => todo.title));

      async function ensureTodo(title: string) {
        if (existingTodoTitles.has(title)) return;
        existingTodoTitles.add(title);
        try {
          const todo = await createTodo({ title, completed: false });
          createdTodoIds.push(todo.id);
        } catch (err) {
          debugLog("Todo creation failed during tour scheduling", {
            error: err instanceof Error ? err.message : String(err),
            leadId: rollbackLeadId,
            title,
          });
        }
      }

      if (scheduleSuppliers) {
        for (const missingSupplier of scheduleSuppliers.missing) {
          await ensureTodo(
            `Contact ${missingSupplier.supplierName} (${missingSupplier.supplierType}) for ${clientName} - reservation confirmation ${reference}`
          );
        }
      }

      for (const warning of availabilityWarnings) {
        await ensureTodo(
          `Review supplier availability for ${clientName} - ${warning}`
        );
      }

      if (!tour.clientConfirmationSentAt && lead.email?.trim()) {
        try {
          await sendTourConfirmationWithInvoice({
            clientName: lead.name,
            clientEmail: lead.email,
            packageName: pkg.name,
            startDate: date,
            endDate,
            pax,
            reference,
            invoice: invoice ?? undefined,
          });
          const updatedTour = await updateTour(tour.id, {
            clientConfirmationSentAt: new Date().toISOString(),
          });
          if (updatedTour) tour = updatedTour;
        } catch (err) {
          debugLog("Tour confirmation email failed", {
            error: err instanceof Error ? err.message : String(err),
            leadId: rollbackLeadId,
          });
        }
      }

      if (scheduleSuppliers && !tour.supplierNotificationsSentAt) {
        for (const supplier of scheduleSuppliers.withEmail) {
          try {
            await sendSupplierReservationEmail({
              supplierEmail: supplier.email,
              supplierName: supplier.supplierName,
              supplierType: supplier.supplierType as
                | "Accommodation"
                | "Transport"
                | "Meals",
              clientName,
              accompaniedGuestName: lead.accompaniedGuestName,
              reference,
              packageName: pkg.name,
              optionLabel: supplier.optionLabel || "As per package",
              checkInDate: date,
              checkOutDate: endDate,
              pax,
              duration: pkg.duration,
            });
          } catch (err) {
            debugLog("Supplier reservation email failed", {
              error: err instanceof Error ? err.message : String(err),
              supplier: supplier.supplierName,
              leadId: rollbackLeadId,
            });
            await ensureTodo(
              `Email ${supplier.supplierName} (${supplier.supplierType}) manually for ${clientName} - reservation confirmation ${reference}`
            );
          }
        }

        const updatedTour = await updateTour(tour.id, {
          supplierNotificationsSentAt: new Date().toISOString(),
        });
        if (updatedTour) tour = updatedTour;
      }
    } catch (err) {
      debugLog("Post-schedule notifications failed", {
        error: err instanceof Error ? err.message : String(err),
        leadId: rollbackLeadId,
        tourId: tour.id,
      });
    }

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/todos");
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/tours/${tour.id}`);
    revalidatePath("/");
    return {
      id: tour.id,
      warnings: availabilityWarnings,
      availabilityStatus,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await rollback?.();
    if (leadId) {
      await recordAuditEvent({
        entityType: "lead",
        entityId: leadId,
        action: "schedule_failed",
        summary: "Tour scheduling failed and changes were rolled back",
        details: [msg],
      });
    }
    return { error: msg };
  }
}

/** Mark tour as completed & paid: update tour status, payment status, invoice status, send receipt email. */
export async function markTourCompletedPaidAction(
  tourId: string
): Promise<{ success?: boolean; paymentId?: string; error?: string }> {
  let rollback: (() => Promise<void>) | null = null;

  try {
    const tour = await getTour(tourId);
    if (!tour) return { error: "Tour not found" };
    if (tour.status === "completed") return { error: "Tour is already completed" };

    const lead = await getLead(tour.leadId);
    if (!lead) return { error: "Lead not found" };

    const originalTourState = {
      status: tour.status,
      paymentReceiptSentAt: tour.paymentReceiptSentAt,
    };
    let payment = await getPaymentByTourId(tourId);
    let createdPaymentId: string | null = null;
    const originalPaymentState = payment
      ? {
          status: payment.status,
        }
      : null;
    const existingInvoice = await getInvoiceByLeadId(lead.id);
    const originalInvoiceState = existingInvoice
      ? {
          status: existingInvoice.status,
          paidAt: existingInvoice.paidAt,
        }
      : null;

    rollback = async () => {
      await Promise.allSettled([
        ...(createdPaymentId ? [deletePayment(createdPaymentId)] : []),
        ...(!createdPaymentId && payment && originalPaymentState
          ? [updatePayment(payment.id, originalPaymentState)]
          : []),
        updateTour(tourId, originalTourState),
        ...(existingInvoice && originalInvoiceState
          ? [updateInvoice(existingInvoice.id, originalInvoiceState)]
          : []),
      ]);
    };

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
      createdPaymentId = payment.id;
    } else {
      const updatedPayment = await updatePayment(payment.id, {
        status: "completed",
      });
      if (!updatedPayment) {
        return { error: "Payment could not be updated" };
      }
      payment = updatedPayment;
    }

    const updatedTour = await updateTour(tourId, { status: "completed" });
    if (!updatedTour) {
      await rollback?.();
      return { error: "Tour could not be updated" };
    }

    const invoice = existingInvoice;
    if (invoice) {
      const updatedInvoice = await updateInvoice(invoice.id, {
        status: "paid",
        paidAt: new Date().toISOString().slice(0, 10),
      });
      if (!updatedInvoice) {
        await rollback?.();
        return { error: "Invoice could not be updated" };
      }
    }

    await recordAuditEvent({
      entityType: "payment",
      entityId: payment.id,
      action: createdPaymentId ? "created" : "status_changed",
      summary: `Payment marked completed for tour ${tour.packageName}`,
      details: [
        `Amount: ${payment.amount} ${payment.currency}`,
        `Client: ${lead.name}`,
      ],
    });

    await recordAuditEvent({
      entityType: "tour",
      entityId: tour.id,
      action: "completed",
      summary: `Tour marked completed for ${lead.name}`,
      details: [`Package: ${tour.packageName}`],
    });

    if (invoice) {
      await recordAuditEvent({
        entityType: "invoice",
        entityId: invoice.id,
        action: "status_changed",
        summary: `Invoice ${invoice.invoiceNumber} marked paid from completed tour`,
      });
    }

    if (lead.email?.trim() && !tour.paymentReceiptSentAt) {
      try {
        await sendPaymentReceiptEmail({
          clientEmail: lead.email,
          clientName: lead.name,
          amount: tour.totalValue,
          currency: tour.currency,
          description: payment.description,
          reference: lead.reference,
          date: payment.date,
        });
        await updateTour(tourId, { paymentReceiptSentAt: new Date().toISOString() });
      } catch (err) {
        debugLog("Payment receipt email failed", {
          error: err instanceof Error ? err.message : String(err),
          tourId,
        });
      }
    }

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/payments");
    revalidatePath(`/admin/tours/${tourId}`);
    revalidatePath("/");
    return { success: true, paymentId: payment.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await rollback?.();
    return { error: msg };
  }
}
