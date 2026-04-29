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
  ensureCustomRoutePlaceholderPackageId,
  extractErrorMessage,
} from "@/lib/db";
import { createInvoiceFromLead } from "@/app/actions/invoices";
import { getLeadBookingFinancials } from "@/lib/booking-pricing";
import { getSuppliersForSchedule, getBookingBreakdownBySupplier } from "@/lib/booking-breakdown";
import { assessTourAvailability } from "@/lib/tour-availability";
import { debugLog } from "@/lib/debug";
import {
  sendTourConfirmationWithInvoice,
  sendSupplierReservationEmail,
  sendPaymentReceiptEmail,
  isEmailConfigured,
} from "@/lib/email";
import { getAuditLogsForEntities, recordAuditEvent } from "@/lib/audit";
import {
  createPackageSnapshotFromLead,
  resolveLeadPackage,
  resolveTourPackage,
} from "@/lib/package-snapshot";
import {
  createCustomRoutePackageSnapshot,
  getCustomRouteMetaFromAuditLogs,
} from "@/lib/custom-route-booking";
import type { Lead, TourPackage, TourStatus } from "@/lib/types";
import { requireAdmin } from "@/lib/admin-session";

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

async function hydrateCustomRouteSnapshot(lead: Lead): Promise<Lead> {
  if (lead.packageSnapshot || lead.packageId) return lead;

  const auditLogs = await getAuditLogsForEntities(
    [{ entityType: "lead", entityId: lead.id }],
    30
  );
  const customRoute = getCustomRouteMetaFromAuditLogs(auditLogs);
  if (!customRoute) return lead;

  const packageSnapshot = createCustomRoutePackageSnapshot(lead, customRoute);

  // Mirror the snapshot's per-night accommodation selection back onto
  // the lead row. The supplier breakdown helper
  // (`getBookingBreakdownBySupplier`) reads `lead.selectedAccommodationByNight`
  // *not* `lead.packageSnapshot.selectedAccommodationByNight`, so without
  // this write the per-night selection only lives on the snapshot and
  // the breakdown still emits zero supplier rows for custom routes.
  // Only write the lead column when we actually have a map to set, to
  // avoid clobbering anything an admin added manually.
  const leadPatch: Parameters<typeof updateLead>[1] = { packageSnapshot };
  if (
    packageSnapshot.selectedAccommodationByNight &&
    Object.keys(packageSnapshot.selectedAccommodationByNight).length > 0 &&
    !lead.selectedAccommodationByNight
  ) {
    leadPatch.selectedAccommodationByNight =
      packageSnapshot.selectedAccommodationByNight;
  }

  const snappedLead = await updateLead(lead.id, leadPatch);
  return (
    snappedLead ?? {
      ...lead,
      packageSnapshot,
      selectedAccommodationByNight:
        leadPatch.selectedAccommodationByNight ?? lead.selectedAccommodationByNight,
    }
  );
}

export async function createTourAction(formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  let rollback: (() => Promise<void>) | null = null;

  try {
    let lead = await getLead(leadId);
    if (!lead) return { error: "Booking not found" };

    lead = await hydrateCustomRouteSnapshot(lead);

    if (!lead.packageId && !lead.packageSnapshot) {
      return {
        error:
          "Booking has no package or saved custom route details. Edit the booking to add one before scheduling.",
      };
    }

    const livePackage = lead.packageId ? await getPackage(lead.packageId) : null;
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

    // For custom-route leads, `lead.packageId` is undefined (the route
    // builder doesn't set it — route data lives on `packageSnapshot`).
    // But several downstream helpers (`getBookingBreakdownBySupplier`,
    // `getSuppliersForSchedule`, etc.) guard on
    // `lead.packageId === pkg.id` and bail to null otherwise — which
    // silently skips supplier payable rows AND supplier reservation
    // emails for every custom-route booking. Patch the in-memory lead
    // so those guards pass; we don't persist this back to the leads
    // table — it's a runtime-only alignment.
    if (!lead.packageId && pkg.id) {
      lead = { ...lead, packageId: pkg.id };
    }

    // Custom routes synthesize `pkg.id = "custom_route_<lead.id>"` (see
    // `lib/custom-route-booking.ts`) — that id has no row in the
    // `packages` table, so writing it to `tours.package_id` violates the
    // FK constraint (Supabase 23503). And the column is also NOT NULL,
    // so we can't just write null (Supabase 23502).
    //
    // Solution: route every custom-route tour at a single shared
    // placeholder package row (`ensureCustomRoutePlaceholderPackageId`
    // creates it on first use, archived so it never appears in the
    // catalog). The full pricing + itinerary still lives on
    // `tour.packageSnapshot`, which is what `resolveTourPackage` reads.
    const isCustomRoutePackage = pkg.id.startsWith("custom_route_");
    const tourPackageId = isCustomRoutePackage
      ? await ensureCustomRoutePlaceholderPackageId()
      : pkg.id;

    const rollbackLeadId = lead.id;
    const originalLeadState = toLeadRollbackData(lead);
    let leadWasMutated = false;
    let tourWasMutated = false;
    let createdTourId: string | null = null;
    let createdInvoiceId: string | null = null;
    let createdPaymentId: string | null = null;
    let existingTourSnapshot: {
      id: string;
      data: ReturnType<typeof toTourRollbackData>;
    } | null = null;
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

    if (lead.status !== "scheduled") {
      const updatedLead = await updateLead(lead.id, {
        status: "scheduled",
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
    existingTourSnapshot = existingTour
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
          .filter(
            (id): id is string => Boolean(id) && id !== livePackage?.id
          )
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
        const livePkg = tour.packageId
          ? packagesById.get(tour.packageId) ?? null
          : null;
        const contextPackage = resolveTourPackage(tour, livePkg, contextLead);
        if (!contextLead || !contextPackage) return null;
        return { lead: contextLead, pkg: contextPackage };
      },
    });
    const availabilityStatus = availability.status ?? "ready";
    const availabilityWarnings = availability.warnings ?? [];

    let tour = existingTour;
    if (!tour) {
      tour = await createTour({
        packageId: tourPackageId,
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
        (existingTour.packageId ?? undefined) !== tourPackageId ||
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
          packageId: tourPackageId,
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
    let invoiceIdForPayment = invoice?.id;
    let invoiceWarning: string | null = null;
    if (!invoice) {
      try {
        const invResult = await createInvoiceFromLead(leadId);
        if (invResult.error) {
          invoiceWarning = `Invoice was not created automatically: ${invResult.error}`;
        } else if (invResult.success && invResult.invoiceId) {
          invoiceIdForPayment = invResult.invoiceId;
          if (invResult.created) {
            createdInvoiceId = invResult.invoiceId;
          }
          invoice = invResult.invoice;
          if (!invoice) {
            invoiceWarning =
              "Invoice was created, but could not be loaded immediately. You can open it from Invoices after refresh.";
          }
        } else {
          invoiceWarning =
            "Invoice was not confirmed automatically. You can create it from the booking later.";
        }
      } catch (err) {
        const msg = extractErrorMessage(err);
        invoiceWarning = `Invoice was not created automatically: ${msg}`;
      }
    }

    if (invoiceWarning) {
      debugLog("Invoice creation skipped during scheduling", {
        warning: invoiceWarning,
        leadId: lead.id,
        tourId: tour.id,
      });
      await recordAuditEvent({
        entityType: "lead",
        entityId: lead.id,
        action: "invoice_followup_needed",
        summary: "Tour scheduled, but invoice needs follow-up",
        details: [invoiceWarning],
      });
    }

    // Denormalize tour confirmationId onto the invoice so reconciliation
    // can chain invoice → tour in a single lookup. Best-effort.
    if (
      invoice &&
      tour.confirmationId &&
      invoice.confirmationId !== tour.confirmationId
    ) {
      try {
        const updatedInv = await updateInvoice(invoice.id, {
          confirmationId: tour.confirmationId,
        });
        if (updatedInv) invoice = updatedInv;
      } catch (err) {
        debugLog("Invoice confirmationId link failed", {
          error: extractErrorMessage(err),
          invoiceId: invoice.id,
          tourId: tour.id,
        });
      }
    }

    let payment = await getPaymentByTourId(tour.id);
    if (!payment) {
      try {
        payment = await createPayment({
          type: "incoming",
          amount: totalValue,
          currency: pkg.currency,
          description: `Tour: ${pkg.name} – ${clientName}`,
          clientName: lead.name,
          reference,
          confirmationId: tour.confirmationId,
          leadId: lead.id,
          tourId: tour.id,
          invoiceId: invoiceIdForPayment,
          status: guestPaidOnline ? "completed" : "pending",
          date: new Date().toISOString().slice(0, 10),
        });
        createdPaymentId = payment.id;
      } catch (err) {
        const msg = extractErrorMessage(err);
        debugLog("createPayment failed during scheduling", {
          error: msg,
          leadId: rollbackLeadId,
          tourId: tour.id,
        });
        await rollback?.();
        await recordAuditEvent({
          entityType: "lead",
          entityId: lead.id,
          action: "schedule_failed",
          summary: "Tour scheduling failed and changes were rolled back",
          details: [`Payment could not be created: ${msg}`],
        });
        return {
          error: `Payment could not be created: ${msg}. Check booking totals and try again.`,
        };
      }
    } else {
      const updatedPayment = await updatePayment(payment.id, {
        amount: totalValue,
        currency: pkg.currency,
        description: `Tour: ${pkg.name} – ${clientName}`,
        clientName: lead.name,
        reference,
        leadId: lead.id,
        invoiceId: invoiceIdForPayment,
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

    // Tour + invoice + payment all persisted. From here on, NEVER roll back —
    // audit events and supplier payables are best-effort. Any error after this
    // line should not delete the successfully-scheduled tour.
    rollback = null;

    // Check email config once, up front. If RESEND_API_KEY is missing,
    // every email function would individually return ok:false and log a
    // per-template "*_email_failed" audit event. That fills /admin/comms
    // with redundant noise. Instead: log ONE summary event, set a
    // user-visible warning, and skip every email block below by gating
    // on `emailConfigured`. The user sees a single clear warning and
    // can fix it (set RESEND_API_KEY in Vercel) and re-schedule.
    const emailConfigured = isEmailConfigured();
    let emailConfigWarning: string | null = null;
    if (!emailConfigured) {
      emailConfigWarning =
        "Emails were skipped: Resend (email provider) is not configured. " +
        "Set RESEND_API_KEY in Vercel environment variables, then re-schedule to send confirmations and supplier reservations.";
      await recordAuditEvent({
        entityType: "tour",
        entityId: tour.id,
        action: "schedule_emails_skipped_unconfigured",
        summary:
          "All scheduling emails skipped — Resend (RESEND_API_KEY) is not configured.",
        details: [
          "Set RESEND_API_KEY in Vercel → Project Settings → Environment Variables.",
          "After deploy, re-trigger scheduling (or click 'Resend supplier emails' / 'Resend guest confirmation') to send.",
        ],
        metadata: {
          channel: "email",
          template: "all",
          status: "skipped",
          reason: "provider_not_configured",
        },
      });
    }

    // Best-effort audit events (recordAuditEvent already catches internally,
    // but wrap defensively in case of unexpected throws).
    try {
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
    } catch (err) {
      debugLog("Audit events after scheduling failed", {
        error: extractErrorMessage(err),
        tourId: tour.id,
      });
    }

    // Best-effort supplier payables (outgoing records per supplier).
    // (`lead.packageId` was already patched above for custom routes so
    // the breakdown's guard passes.)
    try {
      const breakdown = getBookingBreakdownBySupplier(lead, pkg, suppliers);
      if (breakdown && breakdown.supplierItems.length > 0) {
        const bySupplier = new Map<string, { name: string; amount: number; currency: string }>();
        for (const item of breakdown.supplierItems) {
          if (item.supplierId.startsWith("custom_")) continue;
          const cost = item.costAmount ?? item.amount;
          const existing = bySupplier.get(item.supplierId);
          if (existing) {
            existing.amount += cost;
          } else {
            bySupplier.set(item.supplierId, {
              name: item.supplierName,
              amount: cost,
              currency: item.currency,
            });
          }
        }
        const today = new Date().toISOString().slice(0, 10);
        for (const [supplierId, info] of bySupplier) {
          try {
            await createPayment({
              type: "outgoing",
              amount: info.amount,
              currency: info.currency,
              description: `Supplier payable – ${info.name} – ${pkg.name} (${reference})`,
              supplierId,
              supplierName: info.name,
              confirmationId: tour.confirmationId,
              tourId: tour.id,
              leadId: lead.id,
              status: "pending",
              date: today,
            });
          } catch (err) {
            debugLog("Supplier payable creation failed", {
              error: extractErrorMessage(err),
              supplierId,
              tourId: tour.id,
            });
          }
        }
      }
    } catch (err) {
      debugLog("Supplier payables block threw", {
        error: extractErrorMessage(err),
        tourId: tour.id,
      });
    }

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
            error: extractErrorMessage(err),
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

      if (emailConfigured && !tour.clientConfirmationSentAt && lead.email?.trim()) {
        try {
          // Pre-render the itinerary so the confirmation email ships
          // both the invoice and the day-by-day plan as PDFs in one
          // shot. We swallow render errors here — the email should
          // still go out with whatever attachments succeeded rather
          // than fail the whole confirmation step.
          let itineraryAttachment:
            | { content: Buffer; filename?: string }
            | undefined;
          try {
            const { generateItineraryPdf } = await import(
              "@/lib/itinerary-pdf"
            );
            const itineraryBuffer = await generateItineraryPdf({
              tour,
              pkg,
              lead,
            });
            itineraryAttachment = {
              content: itineraryBuffer,
              filename: `Itinerary-${(tour.confirmationId || tour.id).replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`,
            };
          } catch (pdfErr) {
            debugLog("Itinerary PDF skipped on confirmation", {
              error: extractErrorMessage(pdfErr),
              tourId: tour.id,
            });
          }

          const emailResult = await sendTourConfirmationWithInvoice({
            clientName: lead.name,
            clientEmail: lead.email,
            packageName: pkg.name,
            startDate: date,
            endDate,
            pax,
            reference,
            invoice: invoice ?? undefined,
            itineraryPdf: itineraryAttachment,
          });
          if (emailResult.ok) {
            const updatedTour = await updateTour(tour.id, {
              clientConfirmationSentAt: new Date().toISOString(),
            });
            if (updatedTour) tour = updatedTour;
            await recordAuditEvent({
              entityType: "tour",
              entityId: tour.id,
              action: "guest_confirmation_emailed",
              summary: `Tour confirmation emailed to ${lead.email}`,
              details: [`Package: ${pkg.name}`, `Reference: ${reference}`],
              metadata: {
                channel: "email",
                recipient: lead.email,
                template: "tour_confirmation_with_invoice",
                status: "sent",
              },
            });
          } else {
            await recordAuditEvent({
              entityType: "tour",
              entityId: tour.id,
              action: "guest_confirmation_email_failed",
              summary: `Guest confirmation email failed: ${emailResult.error ?? "unknown"}`,
              details: [`Recipient: ${lead.email}`, `Error: ${emailResult.error ?? "unknown"}`],
              metadata: {
                channel: "email",
                recipient: lead.email,
                template: "tour_confirmation_with_invoice",
                status: "failed",
                error: emailResult.error ?? "unknown",
              },
            });
          }
        } catch (err) {
          const msg = extractErrorMessage(err);
          debugLog("Tour confirmation email failed", {
            error: msg,
            leadId: rollbackLeadId,
          });
          await recordAuditEvent({
            entityType: "tour",
            entityId: tour.id,
            action: "guest_confirmation_email_failed",
            summary: `Guest confirmation email threw: ${msg}`,
            details: [`Recipient: ${lead.email}`, `Error: ${msg}`],
            metadata: {
              channel: "email",
              recipient: lead.email,
              template: "tour_confirmation_with_invoice",
              status: "failed",
              error: msg,
            },
          });
        }
      }

      // Visibility: if no suppliers to email, still log an audit event so
      // the admin can see in /admin/communications that nothing went out
      // and why — otherwise it looks like a silent failure.
      if (!scheduleSuppliers) {
        await recordAuditEvent({
          entityType: "tour",
          entityId: tour.id,
          action: "supplier_reservation_email_skipped",
          summary: "No supplier reservation emails sent — booking options are not linked to catalog suppliers.",
          details: [
            "Package options (hotel / transport / meal) don't have supplierId set, so the system can't look up contact emails.",
            "Fix: link package options to real entries in Hotels & Suppliers, or send manually.",
          ],
          metadata: {
            channel: "email",
            template: "supplier_reservation",
            status: "skipped",
            reason: "breakdown_missing",
          },
        });
      } else if (
        !tour.supplierNotificationsSentAt &&
        scheduleSuppliers.withEmail.length === 0
      ) {
        const missingList = scheduleSuppliers.missing
          .map((m) => `${m.supplierName} (${m.supplierType})`)
          .join(", ");
        await recordAuditEvent({
          entityType: "tour",
          entityId: tour.id,
          action: "supplier_reservation_email_skipped",
          summary:
            scheduleSuppliers.missing.length > 0
              ? `Suppliers identified but have no email on file: ${missingList}`
              : "No supplier reservation emails to send for this booking.",
          details:
            scheduleSuppliers.missing.length > 0
              ? [
                  "Fix: open each supplier in Hotels & Suppliers and add an email, then resend from /admin/communications.",
                ]
              : [],
          metadata: {
            channel: "email",
            template: "supplier_reservation",
            status: "skipped",
            reason: scheduleSuppliers.missing.length > 0 ? "no_email_on_supplier" : "no_suppliers_linked",
            missing: scheduleSuppliers.missing.map((m) => m.supplierName),
          },
        });
        // Mark so we don't re-log on every repeated schedule attempt.
        const updatedTour = await updateTour(tour.id, {
          supplierNotificationsSentAt: new Date().toISOString(),
        });
        if (updatedTour) tour = updatedTour;
      }

      if (emailConfigured && scheduleSuppliers && !tour.supplierNotificationsSentAt) {
        for (const supplier of scheduleSuppliers.withEmail) {
          try {
            const emailResult = await sendSupplierReservationEmail({
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
            if (emailResult.ok) {
              await recordAuditEvent({
                entityType: "tour",
                entityId: tour.id,
                action: "supplier_reservation_emailed",
                summary: `Reservation emailed to ${supplier.supplierName}`,
                details: [
                  `Supplier: ${supplier.supplierName} (${supplier.supplierType})`,
                  `Recipient: ${supplier.email}`,
                  `Reference: ${reference}`,
                ],
                metadata: {
                  channel: "email",
                  recipient: supplier.email,
                  template: "supplier_reservation",
                  supplierName: supplier.supplierName,
                  supplierType: supplier.supplierType,
                  status: "sent",
                },
              });
            } else {
              await recordAuditEvent({
                entityType: "tour",
                entityId: tour.id,
                action: "supplier_reservation_email_failed",
                summary: `Supplier email to ${supplier.supplierName} failed: ${emailResult.error ?? "unknown"}`,
                details: [
                  `Supplier: ${supplier.supplierName}`,
                  `Recipient: ${supplier.email}`,
                  `Error: ${emailResult.error ?? "unknown"}`,
                ],
                metadata: {
                  channel: "email",
                  recipient: supplier.email,
                  template: "supplier_reservation",
                  supplierName: supplier.supplierName,
                  supplierType: supplier.supplierType,
                  status: "failed",
                  error: emailResult.error ?? "unknown",
                },
              });
              await ensureTodo(
                `Email ${supplier.supplierName} (${supplier.supplierType}) manually for ${clientName} - reservation confirmation ${reference}`
              );
            }
          } catch (err) {
            const msg = extractErrorMessage(err);
            debugLog("Supplier reservation email failed", {
              error: msg,
              supplier: supplier.supplierName,
              leadId: rollbackLeadId,
            });
            await recordAuditEvent({
              entityType: "tour",
              entityId: tour.id,
              action: "supplier_reservation_email_failed",
              summary: `Supplier email to ${supplier.supplierName} threw: ${msg}`,
              details: [
                `Supplier: ${supplier.supplierName}`,
                `Recipient: ${supplier.email}`,
                `Error: ${msg}`,
              ],
              metadata: {
                channel: "email",
                recipient: supplier.email,
                template: "supplier_reservation",
                supplierName: supplier.supplierName,
                supplierType: supplier.supplierType,
                status: "failed",
                error: msg,
              },
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
        error: extractErrorMessage(err),
        leadId: rollbackLeadId,
        tourId: tour.id,
      });
    }

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/receivable");
    revalidatePath("/admin/payables");
    revalidatePath("/admin/todos");
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/tours/${tour.id}`);
    revalidatePath("/");
    return {
      id: tour.id,
      warnings: [
        ...availabilityWarnings,
        ...(invoiceWarning ? [invoiceWarning] : []),
        ...(emailConfigWarning ? [emailConfigWarning] : []),
      ],
      availabilityStatus,
    };
  } catch (err) {
    // Use extractErrorMessage so plain-object Supabase errors
    // (`{ message, code, details, hint }`, NOT Error instances) render
    // as readable text instead of "[object Object]". This is defense
    // in depth — every db.ts write helper already wraps with
    // reportWriteFailure, but anything that bypasses that path (a
    // direct supabase call, a third-party SDK, a thrown literal) lands
    // here and would otherwise produce useless error UI.
    const msg = extractErrorMessage(err);
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

/**
 * Generate the tour itinerary PDF and email it to the guest.
 */
export async function sendItineraryToGuestAction(
  tourId: string
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const tour = await getTour(tourId);
  if (!tour) return { error: "Tour not found" };
  const lead = await getLead(tour.leadId);
  if (!lead) return { error: "Booking not found for this tour" };

  const email = lead.email?.trim();
  if (!email) return { error: "This booking has no guest email. Edit the booking to add one." };

  const livePackage = await getPackage(tour.packageId);
  const { resolveTourPackage } = await import("@/lib/package-snapshot");
  const pkg = resolveTourPackage(tour, livePackage, lead);

  const { generateItineraryPdf } = await import("@/lib/itinerary-pdf");
  const pdfBuffer = await generateItineraryPdf({ tour, pkg, lead });

  const { sendItineraryEmail } = await import("@/lib/email");
  const result = await sendItineraryEmail({
    clientName: lead.name,
    clientEmail: email,
    packageName: tour.packageName,
    startDate: tour.startDate,
    endDate: tour.endDate,
    reference: lead.reference,
    pdfBuffer,
    filename: `Itinerary-${(tour.confirmationId || tour.id).replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`,
  });

  await recordAuditEvent({
    entityType: "tour",
    entityId: tour.id,
    action: result.ok ? "itinerary_emailed" : "itinerary_email_failed",
    summary: result.ok
      ? `Itinerary emailed to ${email}`
      : `Itinerary email failed: ${result.error ?? "unknown error"}`,
    details: result.ok
      ? [`Recipient: ${email}`, `Package: ${tour.packageName}`]
      : [`Recipient: ${email}`, `Error: ${result.error ?? "unknown"}`],
    metadata: {
      channel: "email",
      recipient: email,
      template: "itinerary",
      status: result.ok ? "sent" : "failed",
      ...(result.ok ? {} : { error: result.error ?? "unknown" }),
    },
  });

  if (!result.ok) return { error: result.error ?? "Failed to send itinerary" };

  revalidatePath(`/admin/tours/${tourId}`);
  return { success: true };
}

/** Mark tour as completed & paid: update tour status, payment status, invoice status, send receipt email. */
export async function markTourCompletedPaidAction(
  tourId: string
): Promise<{ success?: boolean; paymentId?: string; error?: string }> {
  await requireAdmin();
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

    // Keep the booking status in sync — a tour marked completed means the
    // booking itself is completed (simplified 4-status model).
    try {
      await updateLead(tour.leadId, { status: "completed" });
    } catch (err) {
      debugLog("Failed to mark lead completed after tour completion", {
        tourId,
        leadId: tour.leadId,
        error: extractErrorMessage(err),
      });
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
        const emailResult = await sendPaymentReceiptEmail({
          clientEmail: lead.email,
          clientName: lead.name,
          amount: tour.totalValue,
          currency: tour.currency,
          description: payment.description,
          reference: lead.reference,
          date: payment.date,
        });
        if (emailResult.ok) {
          await updateTour(tourId, { paymentReceiptSentAt: new Date().toISOString() });
          await recordAuditEvent({
            entityType: "tour",
            entityId: tourId,
            action: "payment_receipt_emailed",
            summary: `Payment receipt emailed to ${lead.email}`,
            details: [`Amount: ${tour.totalValue} ${tour.currency}`],
            metadata: {
              channel: "email",
              recipient: lead.email,
              template: "payment_receipt",
              status: "sent",
            },
          });
        } else {
          await recordAuditEvent({
            entityType: "tour",
            entityId: tourId,
            action: "payment_receipt_email_failed",
            summary: `Payment receipt email failed: ${emailResult.error ?? "unknown"}`,
            details: [`Recipient: ${lead.email}`, `Error: ${emailResult.error ?? "unknown"}`],
            metadata: {
              channel: "email",
              recipient: lead.email,
              template: "payment_receipt",
              status: "failed",
              error: emailResult.error ?? "unknown",
            },
          });
        }
      } catch (err) {
        const msg = extractErrorMessage(err);
        debugLog("Payment receipt email failed", {
          error: msg,
          tourId,
        });
        await recordAuditEvent({
          entityType: "tour",
          entityId: tourId,
          action: "payment_receipt_email_failed",
          summary: `Payment receipt email threw: ${msg}`,
          details: [`Recipient: ${lead.email}`, `Error: ${msg}`],
          metadata: {
            channel: "email",
            recipient: lead.email,
            template: "payment_receipt",
            status: "failed",
            error: msg,
          },
        });
      }
    }

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/payments");
    revalidatePath(`/admin/tours/${tourId}`);
    revalidatePath("/");
    return { success: true, paymentId: payment.id };
  } catch (err) {
    const msg = extractErrorMessage(err);
    await rollback?.();
    return { error: msg };
  }
}
