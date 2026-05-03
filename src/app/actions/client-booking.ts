"use server";

import { revalidatePath } from "next/cache";
import { createLead, getAllMealPlans, extractErrorMessage } from "@/lib/db";
import { getPackage } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { debugLog } from "@/lib/debug";
import { sendBookingRequestConfirmation } from "@/lib/email";
import { createPackageSnapshot } from "@/lib/package-snapshot";
import {
  calculateBookingSelectionsTotal,
  normalizeSelectedAccommodationByNight,
} from "@/lib/booking-pricing";
import {
  isWhatsAppConfigured,
  sendWhatsAppBookingConfirmation,
} from "@/lib/whatsapp";
import { clientBookingSchema, zodErrorMessage } from "@/lib/validation";

export async function createClientBookingAction(
  packageId: string,
  formData: FormData
) {
  // Parse raw fields from form
  const rawPax = formData.get("pax") ? parseInt(String(formData.get("pax")), 10) : undefined;
  const rawTotalPrice = formData.get("totalPrice") ? parseFloat(String(formData.get("totalPrice"))) : undefined;
  const selectedAccommodationByNightRaw = (formData.get("selectedAccommodationByNight") as string)?.trim();
  let selectedAccommodationByNightParsed: Record<string, string> | undefined;
  if (selectedAccommodationByNightRaw) {
    try {
      const parsed = JSON.parse(selectedAccommodationByNightRaw);
      if (parsed && typeof parsed === "object")
        selectedAccommodationByNightParsed = parsed as Record<string, string>;
    } catch {
      /* ignore malformed JSON */
    }
  }

  // Hotel-attached meal plan ids per night (if the guest picked any).
  const selectedMealPlanByNightRaw = (formData.get("selectedMealPlanByNight") as string)?.trim();
  let selectedMealPlanByNightParsed: Record<string, string> | undefined;
  if (selectedMealPlanByNightRaw) {
    try {
      const parsed = JSON.parse(selectedMealPlanByNightRaw);
      if (parsed && typeof parsed === "object")
        selectedMealPlanByNightParsed = parsed as Record<string, string>;
    } catch {
      /* ignore malformed JSON */
    }
  }

  // Validate with Zod
  const parsed = clientBookingSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    email: (formData.get("email") as string)?.trim(),
    phone: (formData.get("phone") as string)?.trim() || undefined,
    travelDate: (formData.get("travelDate") as string)?.trim() || undefined,
    pax: isNaN(rawPax!) ? undefined : rawPax,
    notes: (formData.get("notes") as string)?.trim() || undefined,
    selectedAccommodationOptionId: (formData.get("selectedAccommodationOptionId") as string)?.trim() || undefined,
    selectedAccommodationByNight: selectedAccommodationByNightParsed,
    selectedTransportOptionId: (formData.get("selectedTransportOptionId") as string)?.trim() || undefined,
    selectedMealOptionId: (formData.get("selectedMealOptionId") as string)?.trim() || undefined,
    selectedMealPlanByNight: selectedMealPlanByNightParsed,
    totalPrice: isNaN(rawTotalPrice!) ? undefined : rawTotalPrice,
  });

  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }

  const {
    name,
    email,
    phone,
    travelDate,
    pax,
    notes,
    selectedAccommodationOptionId,
    selectedAccommodationByNight,
    selectedTransportOptionId,
    selectedMealOptionId,
    selectedMealPlanByNight,
    totalPrice: clientReportedTotalPrice,
  } = parsed.data;

  const pkg = await getPackage(packageId);
  if (!pkg) {
    return { error: "Package not found" };
  }

  const normalizedAccommodationByNight =
    normalizeSelectedAccommodationByNight(selectedAccommodationByNight);

  // Load all hotel meal plans ONCE and pass into pricing. This is how
  // hotels actually sell rooms — RO/BB/HB/FB/AI are priced against the
  // room, not as a separate line item — so the total has to reflect it.
  const hotelMealPlans = selectedMealPlanByNight
    ? await getAllMealPlans()
    : [];

  const pricing = calculateBookingSelectionsTotal({
    pkg,
    pax: pax ?? 1,
    selectedAccommodationOptionId: selectedAccommodationOptionId || undefined,
    selectedAccommodationByNight: normalizedAccommodationByNight,
    selectedTransportOptionId: selectedTransportOptionId || undefined,
    selectedMealOptionId: selectedMealOptionId || undefined,
    selectedMealPlanByNight,
    hotelMealPlans,
  });

  if (pricing.errors.length > 0) {
    return { error: pricing.errors[0] };
  }

  if (
    clientReportedTotalPrice != null &&
    Math.abs(clientReportedTotalPrice - pricing.totalPrice) > 0.01
  ) {
    debugLog("Client booking total mismatch", {
      packageId,
      clientReportedTotalPrice,
      computedTotalPrice: pricing.totalPrice,
    });
  }

  // Human-readable "meal plans by night" summary that we append to the
  // lead's notes so the admin sees exactly what the guest picked
  // alongside each hotel (until we add a first-class field on the Lead).
  let mealPlanNote = "";
  if (selectedMealPlanByNight && hotelMealPlans.length > 0) {
    const byId = new Map(hotelMealPlans.map((m) => [m.id, m]));
    const bits = Object.entries(selectedMealPlanByNight)
      .map(([night, mpId]) => {
        const mp = byId.get(mpId);
        if (!mp) return null;
        return `Night ${Number(night) + 1}: ${mp.label}`;
      })
      .filter((v): v is string => !!v);
    if (bits.length > 0) {
      mealPlanNote = `Meal plans: ${bits.join(" · ")}`;
    }
  }
  const combinedNotes = [notes || "", mealPlanNote].filter(Boolean).join(" | ");

  debugLog("createClientBooking", {
    packageId,
    pax,
    totalPrice: pricing.totalPrice,
  });
  const lead = await createLead({
    name,
    email,
    phone: phone || "",
    source: "Client Portal",
    status: "new",
    destination: pkg.destination,
    travelDate: travelDate || undefined,
    pax: pax ?? 1,
    notes: combinedNotes || undefined,
    packageId: pkg.id,
    selectedAccommodationOptionId: selectedAccommodationOptionId || undefined,
    selectedAccommodationByNight: normalizedAccommodationByNight,
    selectedTransportOptionId: selectedTransportOptionId || undefined,
    selectedMealOptionId: selectedMealOptionId || undefined,
    totalPrice: pricing.totalPrice,
    packageSnapshot: createPackageSnapshot({
      pkg,
      selectedAccommodationOptionId: selectedAccommodationOptionId || undefined,
      selectedAccommodationByNight: normalizedAccommodationByNight,
      selectedTransportOptionId: selectedTransportOptionId || undefined,
      selectedMealOptionId: selectedMealOptionId || undefined,
      totalPrice: pricing.totalPrice,
    }),
  });

  await recordAuditEvent({
    entityType: "lead",
    entityId: lead.id,
    action: "created_from_client_portal",
    summary: `Booking created from client portal for ${lead.name}`,
    actor: "Client Portal",
    details: [
      `Package: ${pkg.name}`,
      `Travel date: ${lead.travelDate ?? "TBD"}`,
      `Total: ${pricing.totalPrice} ${pkg.currency}`,
    ],
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/");
  revalidatePath("/my-bookings");

  // Send email confirmation to guest. We await rather than fire-and-forget
  // so the audit event below records reliably in serverless — and so the
  // Communications module ( /admin/communications ) shows every guest
  // email under a tracked `*_emailed` action. See EMAIL_ACTIONS in
  // src/app/admin/communications/page.tsx.
  try {
    const emailResult = await sendBookingRequestConfirmation({
      clientName: lead.name,
      clientEmail: lead.email,
      packageName: pkg.name,
      reference: lead.reference ?? lead.id,
      travelDate: lead.travelDate,
      pax: lead.pax ?? 1,
    });
    await recordAuditEvent({
      entityType: "lead",
      entityId: lead.id,
      action: emailResult.ok
        ? "booking_request_confirmation_emailed"
        : "booking_request_confirmation_email_failed",
      summary: emailResult.ok
        ? `Booking confirmation emailed to ${lead.email}`
        : `Booking confirmation email failed for ${lead.email}: ${emailResult.error ?? "unknown"}`,
      actor: "Client Portal",
      metadata: {
        channel: "email",
        template: "booking_request_confirmation",
        recipient: lead.email,
        status: emailResult.ok ? "sent" : "failed",
        error: emailResult.error,
      },
    });
  } catch (err) {
    debugLog("Booking request email failed", {
      error: extractErrorMessage(err),
      leadId: lead.id,
    });
    await recordAuditEvent({
      entityType: "lead",
      entityId: lead.id,
      action: "booking_request_confirmation_email_failed",
      summary: `Booking confirmation email threw for ${lead.email}`,
      actor: "Client Portal",
      metadata: {
        channel: "email",
        template: "booking_request_confirmation",
        recipient: lead.email,
        status: "failed",
        error: extractErrorMessage(err),
      },
    });
  }

  // Fire-and-forget internal admin alert for the new booking. We
  // intentionally don't await — the guest's `success: true` shouldn't
  // wait on admin notification. But every outcome (sent/skipped/failed)
  // is logged to /admin/communications so the admin can see when their
  // alert pipeline is broken instead of silently missing new bookings.
  (async () => {
    try {
      const { getAppSettings } = await import("@/lib/app-config");
      const { sendInternalAlertEmail, isEmailConfigured } = await import("@/lib/email");
      const settings = await getAppSettings();
      const adminEmail = settings.company.email?.trim();
      if (!adminEmail) {
        await recordAuditEvent({
          entityType: "lead",
          entityId: lead.id,
          action: "admin_new_booking_alert_skipped",
          summary: "New-booking alert skipped — no admin email in /admin/settings → company email.",
          actor: "Client Portal",
          metadata: {
            channel: "email",
            template: "internal_new_booking",
            status: "skipped",
            reason: "no_admin_email",
          },
        });
        return;
      }
      if (!isEmailConfigured()) {
        await recordAuditEvent({
          entityType: "lead",
          entityId: lead.id,
          action: "admin_new_booking_alert_skipped",
          summary: "New-booking alert skipped — Resend (RESEND_API_KEY) is not configured.",
          actor: "Client Portal",
          metadata: {
            channel: "email",
            template: "internal_new_booking",
            recipient: adminEmail,
            status: "skipped",
            reason: "provider_not_configured",
          },
        });
        return;
      }
      await sendInternalAlertEmail({
        to: adminEmail,
        subject: `New booking: ${lead.name} — ${pkg.name}`,
        body: [
          `A new booking has arrived from the client portal.`,
          ``,
          `Guest: ${lead.name} <${lead.email}>`,
          `Package: ${pkg.name}`,
          `Travel date: ${lead.travelDate ?? "TBD"}`,
          `Travelers: ${lead.pax ?? 1}`,
          `Total: ${pricing.totalPrice.toLocaleString()} ${pkg.currency}`,
          ``,
          `Review & approve in the admin portal.`,
        ].join("\n"),
        severity: "info",
      });
      await recordAuditEvent({
        entityType: "lead",
        entityId: lead.id,
        action: "admin_new_booking_alert_sent",
        summary: `New-booking alert sent to ${adminEmail}`,
        actor: "Client Portal",
        metadata: {
          channel: "email",
          recipient: adminEmail,
          template: "internal_new_booking",
          status: "sent",
        },
      });
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      debugLog("Internal new-booking alert failed", {
        error: errMsg,
        leadId: lead.id,
      });
      // Record the failure to /admin/communications so admin sees
      // the gap. Without this row, a missing-email-config or
      // template-render bug would silently swallow every new-booking
      // notification — admin would only notice when guests start
      // complaining that they booked but nobody followed up.
      await recordAuditEvent({
        entityType: "lead",
        entityId: lead.id,
        action: "admin_new_booking_alert_failed",
        summary: `New-booking alert failed: ${errMsg}`,
        actor: "Client Portal",
        metadata: {
          channel: "email",
          template: "internal_new_booking",
          status: "failed",
          error: errMsg,
        },
      });
    }
  })();

  // Send WhatsApp confirmation if configured and client provided phone.
  // Failures get logged to /admin/communications so the admin sees when
  // WhatsApp is broken instead of guessing. (Sending happens in
  // background but the failure path awaits the audit write.)
  if (isWhatsAppConfigured() && lead.phone?.trim()) {
    sendWhatsAppBookingConfirmation({
      clientName: lead.name,
      phone: lead.phone,
      reference: lead.reference ?? lead.id,
      packageName: pkg.name,
      travelDate: lead.travelDate,
      pax: lead.pax,
    }).catch(async (err) => {
      const errMsg = extractErrorMessage(err);
      debugLog("WhatsApp booking confirmation failed", {
        error: errMsg,
        leadId: lead.id,
      });
      try {
        await recordAuditEvent({
          entityType: "lead",
          entityId: lead.id,
          action: "whatsapp_booking_confirmation_failed",
          summary: `WhatsApp confirmation failed for ${lead.name}: ${errMsg}`,
          actor: "Client Portal",
          metadata: {
            channel: "whatsapp",
            recipient: lead.phone,
            template: "booking_confirmation",
            status: "failed",
            error: errMsg,
          },
        });
      } catch {
        // Don't bubble — at this point we've done our best.
      }
    });
  }

  return { success: true, leadId: lead.id, reference: lead.reference ?? undefined };
}
