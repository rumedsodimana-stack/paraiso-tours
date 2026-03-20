"use server";

import { revalidatePath } from "next/cache";
import { createLead } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { debugLog } from "@/lib/debug";
import { sendBookingRequestConfirmation } from "@/lib/email";
import {
  isWhatsAppConfigured,
  sendWhatsAppBookingConfirmation,
} from "@/lib/whatsapp";

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
  const name = input.name?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  const travelDate = input.travelDate?.trim();
  const notes = formatCustomRouteNotes(input);

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  if (!Array.isArray(input.routeStops) || input.routeStops.length === 0) {
    return { error: "Add at least one destination before sending the request." };
  }

  const routeLabel = input.routeStops.map((stop) => stop.destinationName).join(" -> ");

  debugLog("createCustomRouteRequest", {
    email,
    stops: input.routeStops.length,
    estimatedTotal: input.estimatedTotal,
  });

  const lead = await createLead({
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

  sendBookingRequestConfirmation({
    clientName: lead.name,
    clientEmail: lead.email,
    packageName: "Custom Sri Lanka journey",
    reference: lead.reference ?? lead.id,
    travelDate: lead.travelDate,
    pax: lead.pax ?? 1,
  }).catch((err) => {
    debugLog("Custom route email failed", {
      error: err instanceof Error ? err.message : String(err),
      leadId: lead.id,
    });
  });

  if (isWhatsAppConfigured() && lead.phone?.trim()) {
    sendWhatsAppBookingConfirmation({
      clientName: lead.name,
      phone: lead.phone,
      reference: lead.reference ?? lead.id,
      packageName: "Custom Sri Lanka journey",
    }).catch((err) => {
      debugLog("Custom route WhatsApp failed", {
        error: err instanceof Error ? err.message : String(err),
        leadId: lead.id,
      });
    });
  }

  return {
    success: true,
    leadId: lead.id,
    reference: lead.reference ?? undefined,
  };
}
