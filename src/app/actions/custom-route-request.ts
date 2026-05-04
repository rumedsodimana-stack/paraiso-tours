"use server";

import { revalidatePath } from "next/cache";
import { createLead, extractErrorMessage, getLeads } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { debugLog } from "@/lib/debug";
import { sendBookingRequestConfirmation } from "@/lib/email";
import {
  isWhatsAppConfigured,
  sendWhatsAppBookingConfirmation,
} from "@/lib/whatsapp";
import {
  customRouteRequestSchema,
  zodErrorMessage,
} from "@/lib/validation";
import { checkPublicBookingRateLimit } from "@/lib/booking-rate-limit";

export interface CustomRouteRequestStopInput {
  destinationId: string;
  destinationName: string;
  nights: number;
  hotelName?: string;
  hotelId?: string;
  hotelRate?: number;
  hotelCurrency?: string;
  activities: string[];
  legDistanceKm?: number;
  legDriveHours?: number;
}

export interface CustomRouteRequestInput {
  name: string;
  email: string;
  phone?: string;
  travelDate?: string;
  pax: number;
  desiredNights: number;
  stayStyle: string;
  transportLabel: string;
  mealLabel?: string;
  mealRequest?: string;
  accommodationMode?: "auto" | "choose";
  guidanceFee?: number;
  guidanceLabel?: string;
  routeStops: CustomRouteRequestStopInput[];
  estimatedTotal: number;
  estimatedCurrency: string;
  totalDriveHours: number;
  notes?: string;
}

function formatCustomRouteNotes(input: CustomRouteRequestInput) {
  const lines = [
    "Custom route builder request",
    `Stay style: ${input.stayStyle}`,
    `Transport: ${input.transportLabel}`,
    `Meals: ${input.mealLabel || "No meal plan"}`,
    `Accommodation handling: ${
      input.accommodationMode === "choose"
        ? "Guest selected each stay"
        : "Best available stay requested"
    }`,
    `Target nights: ${input.desiredNights}`,
    `Guidance fee: ${(input.guidanceFee ?? 0).toLocaleString()} ${input.estimatedCurrency}${
      input.guidanceLabel ? ` (${input.guidanceLabel})` : ""
    }`,
    `Estimated total: ${input.estimatedTotal.toLocaleString()} ${input.estimatedCurrency}`,
    `Estimated drive time: ${input.totalDriveHours.toFixed(1)} hours`,
    "",
    "Planned route:",
  ];

  input.routeStops.forEach((stop, index) => {
    lines.push(
      `${index + 1}. ${stop.destinationName} - ${stop.nights} night${
        stop.nights === 1 ? "" : "s"
      }`
    );

    if (stop.legDistanceKm != null || stop.legDriveHours != null) {
      lines.push(
        `   Transfer in: ${stop.legDistanceKm ?? 0} km / ${
          stop.legDriveHours != null ? `${stop.legDriveHours.toFixed(1)} h` : "TBD"
        }`
      );
    }

    if (stop.hotelName) {
      lines.push(
        `   Hotel: ${stop.hotelName}${
          stop.hotelRate != null
            ? ` (${stop.hotelRate.toLocaleString()} ${stop.hotelCurrency ?? input.estimatedCurrency} per night)`
            : ""
        }`
      );
    }

    if (stop.activities.length > 0) {
      lines.push(`   Activities: ${stop.activities.join(", ")}`);
    }
  });

  if (input.mealRequest?.trim()) {
    lines.push("", "Meal request:", input.mealRequest.trim());
  }

  if (input.notes?.trim()) {
    lines.push("", "Guest notes:", input.notes.trim());
  }

  return lines.join("\n");
}

export async function createCustomRouteRequestAction(
  input: CustomRouteRequestInput
) {
  // Strict input validation up front. Caps every string + array at
  // sane lengths so a hostile / buggy client can't push a 10MB
  // payload into the DB or 10000 route stops into a single lead.
  const parsed = customRouteRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim();
  const phone = parsed.data.phone?.trim();
  const travelDate = parsed.data.travelDate?.trim();
  const notes = formatCustomRouteNotes(input);

  // Per-email rate limit. Without this, a bot could submit
  // thousands of fake bookings — exhausting Resend daily limits,
  // bloating the DB, and burying real bookings in admin's inbox.
  // The check counts recent leads from the same email; >5 in 1
  // hour rejects the submission with a clear retry message.
  const rateLimit = await checkPublicBookingRateLimit({
    email,
    getLeads,
  });
  if (!rateLimit.ok) {
    return { error: rateLimit.message };
  }

  const routeLabel = input.routeStops.map((stop) => stop.destinationName).join(" -> ");

  debugLog("createCustomRouteRequest", {
    email,
    stops: input.routeStops.length,
    estimatedTotal: input.estimatedTotal,
  });

  let lead;
  try {
    lead = await createLead({
      name,
      email,
      phone: phone || "",
      source: "Client Route Builder",
      status: "new",
      destination: routeLabel,
      travelDate: travelDate || undefined,
      pax: Math.max(1, Number(input.pax) || 1),
      notes,
      totalPrice: Number.isFinite(input.estimatedTotal)
        ? input.estimatedTotal
        : undefined,
    });
  } catch (err) {
    debugLog("createLead failed", {
      error: extractErrorMessage(err),
    });
    return { error: "Failed to save your request. Please try again." };
  }

  await recordAuditEvent({
    entityType: "lead",
    entityId: lead.id,
    action: "created_from_route_builder",
    summary: `Custom route request created for ${lead.name}`,
    actor: "Client Route Builder",
    details: [
      `Route: ${routeLabel}`,
      `Stop count: ${input.routeStops.length}`,
      `Estimated total: ${input.estimatedTotal.toLocaleString()} ${input.estimatedCurrency}`,
      `Travel date: ${travelDate || "TBD"}`,
      `Transport: ${input.transportLabel}`,
      `Meals: ${input.mealLabel || "No meal plan"}`,
    ],
    metadata: {
      routeStops: input.routeStops,
      stayStyle: input.stayStyle,
      transportLabel: input.transportLabel,
      mealLabel: input.mealLabel ?? "No meal plan",
      mealRequest: input.mealRequest ?? "",
      accommodationMode: input.accommodationMode ?? "auto",
      guidanceFee: input.guidanceFee ?? 0,
      guidanceLabel: input.guidanceLabel ?? "",
      desiredNights: input.desiredNights,
    },
  });

  revalidatePath("/admin/bookings");
  revalidatePath("/my-bookings");
  revalidatePath("/journey-builder");

  // Awaited (not fire-and-forget) so the audit event below records
  // reliably in serverless and the email shows up in /admin/communications.
  try {
    const emailResult = await sendBookingRequestConfirmation({
      clientName: lead.name,
      clientEmail: lead.email,
      packageName: "Custom Sri Lanka journey",
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
        ? `Custom journey confirmation emailed to ${lead.email}`
        : `Custom journey confirmation email failed for ${lead.email}: ${emailResult.error ?? "unknown"}`,
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
    debugLog("Custom route email failed", {
      error: extractErrorMessage(err),
      leadId: lead.id,
    });
    await recordAuditEvent({
      entityType: "lead",
      entityId: lead.id,
      action: "booking_request_confirmation_email_failed",
      summary: `Custom journey confirmation email threw for ${lead.email}`,
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

  if (isWhatsAppConfigured() && lead.phone?.trim()) {
    // Records the outcome in /admin/communications so the admin
    // sees EVERY WhatsApp confirmation in the inbox — sent
    // successfully, failed softly (helper returned ok:false), or
    // threw outright. The previous .catch-only pattern silently
    // dropped successful confirmations from the inbox.
    (async () => {
      try {
        const r = await sendWhatsAppBookingConfirmation({
          clientName: lead.name,
          phone: lead.phone,
          reference: lead.reference ?? lead.id,
          packageName: "Custom Sri Lanka journey",
          travelDate: lead.travelDate,
          pax: lead.pax,
        });
        if (r.ok) {
          await recordAuditEvent({
            entityType: "lead",
            entityId: lead.id,
            action: "whatsapp_booking_confirmation_sent",
            summary: `WhatsApp confirmation sent to ${lead.name} (${lead.phone})`,
            actor: "Client Route Builder",
            metadata: {
              channel: "whatsapp",
              recipient: lead.phone,
              template: "booking_confirmation",
              status: "sent",
            },
          });
        } else {
          await recordAuditEvent({
            entityType: "lead",
            entityId: lead.id,
            action: "whatsapp_booking_confirmation_failed",
            summary: `WhatsApp confirmation failed for ${lead.name}: ${r.error ?? "unknown"}`,
            actor: "Client Route Builder",
            metadata: {
              channel: "whatsapp",
              recipient: lead.phone,
              template: "booking_confirmation",
              status: "failed",
              error: r.error ?? "unknown",
            },
          });
        }
      } catch (err) {
        const errMsg = extractErrorMessage(err);
        debugLog("Custom route WhatsApp threw", {
          error: errMsg,
          leadId: lead.id,
        });
        try {
          await recordAuditEvent({
            entityType: "lead",
            entityId: lead.id,
            action: "whatsapp_booking_confirmation_failed",
            summary: `WhatsApp confirmation threw for ${lead.name}: ${errMsg}`,
            actor: "Client Route Builder",
            metadata: {
              channel: "whatsapp",
              recipient: lead.phone,
              template: "booking_confirmation",
              status: "failed",
              error: errMsg,
            },
          });
        } catch {
          // Best-effort — done our best.
        }
      }
    })();
  }

  // Auto-trigger booking processor agent. If startup fails (e.g. AI
  // not configured, LangGraph compile error), record an audit row so
  // the admin notices instead of wondering why the agent never ran.
  import("@/app/actions/agents").then(({ startBookingProcessorAction }) => {
    startBookingProcessorAction(lead.id).catch(async (err) => {
      const errMsg = extractErrorMessage(err);
      debugLog("Booking processor agent failed to start", {
        error: errMsg,
        leadId: lead.id,
      });
      try {
        await recordAuditEvent({
          entityType: "lead",
          entityId: lead.id,
          action: "agent_processor_failed_to_start",
          summary: `Booking processor agent failed to start: ${errMsg}`,
          actor: "Client Route Builder",
          details: [
            "The auto-triage agent couldn't run on this booking.",
            "Triage manually from /admin/bookings if needed.",
          ],
          metadata: {
            agent: "booking_processor",
            status: "failed",
            error: errMsg,
          },
        });
      } catch {
        // Best-effort.
      }
    });
  });

  return {
    success: true,
    leadId: lead.id,
    reference: lead.reference ?? undefined,
  };
}
