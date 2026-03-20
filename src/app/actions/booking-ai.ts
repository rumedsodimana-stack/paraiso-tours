"use server";

import { runAiToolAction, type AiToolActionState } from "@/app/actions/ai";
import { getLead } from "@/lib/db";

export interface BookingCopilotInput {
  leadId: string;
  mode: "brief" | "copilot";
  request?: string;
  executeActions?: boolean;
}

function buildBookingContextText(input: {
  id: string;
  reference?: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  travelDate?: string;
  pax?: number;
  destination?: string;
  notes?: string;
}) {
  return [
    "Current booking context:",
    `Booking id: ${input.id}`,
    `Reference: ${input.reference || input.id}`,
    `Client: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone || "Not provided"}`,
    `Status: ${input.status}`,
    `Travel date: ${input.travelDate || "Not set"}`,
    `Pax: ${input.pax ?? "Not set"}`,
    `Destination: ${input.destination || "Not set"}`,
    `Notes: ${input.notes || "None"}`,
    "Always focus on this booking unless the staff request explicitly asks about something else.",
    `Booking query to use for actions: ${input.reference || input.id}`,
  ].join("\n");
}

export async function runBookingCopilotAction(
  input: BookingCopilotInput
): Promise<AiToolActionState> {
  const leadId = input.leadId?.trim();
  if (!leadId) {
    return {
      ok: false,
      message: "Booking reference is missing.",
    };
  }

  const lead = await getLead(leadId);
  if (!lead) {
    return {
      ok: false,
      message: "Booking not found.",
    };
  }

  const formData = new FormData();
  if (input.mode === "brief") {
    formData.set("tool", "booking_brief");
    formData.set("leadId", lead.id);
    return runAiToolAction({ ok: false, message: "" }, formData);
  }

  const request = input.request?.trim();
  if (!request) {
    return {
      ok: false,
      message: "Enter the booking question first.",
    };
  }

  formData.set("tool", "workspace_copilot");
  formData.set(
    "workspaceRequest",
    [
      buildBookingContextText({
        id: lead.id,
        reference: lead.reference,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        travelDate: lead.travelDate,
        pax: lead.pax,
        destination: lead.destination,
        notes: lead.notes,
      }),
      "",
      `Staff request: ${request}`,
    ].join("\n")
  );
  if (input.executeActions) {
    formData.set("executeActions", "on");
  }

  const response = await runAiToolAction({ ok: false, message: "" }, formData);
  return {
    ...response,
    title: response.title || `Booking Copilot · ${lead.reference ?? lead.name}`,
  };
}
