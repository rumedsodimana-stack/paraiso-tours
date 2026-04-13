import { getLead, getHotels, getTours, updateLead } from "@/lib/db";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { isEmailConfigured } from "@/lib/email";
import { debugLog } from "@/lib/debug";
import { agentGenerateText } from "../llm-adapter";
import { createAgentTask, updateAgentThread } from "../db";
import type { BookingProcessorStateType, ItineraryStop, SupplierEmail } from "./state";

/* ------------------------------------------------------------------ */
/*  Helper: parse route stops from lead notes                          */
/* ------------------------------------------------------------------ */

function parseItineraryFromNotes(notes: string, hotels: Awaited<ReturnType<typeof getHotels>>): ItineraryStop[] {
  const stops: ItineraryStop[] = [];
  const lines = notes.split("\n");
  let dayCounter = 0;

  for (const line of lines) {
    // Match lines like: "1. Negombo - 2 night(s)"
    const stopMatch = line.match(/^\s*(\d+)\.\s+(.+?)\s*-\s*(\d+)\s*night/i);
    if (stopMatch) {
      const destName = stopMatch[2].trim();
      const nights = parseInt(stopMatch[3], 10);
      for (let n = 0; n < nights; n++) {
        dayCounter++;
        stops.push({ day: dayCounter, destination: destName, activities: [] });
      }
      continue;
    }

    // Match hotel lines: "   Hotel: Fort Bazaar (95 USD per night)"
    const hotelMatch = line.match(/^\s+Hotel:\s+(.+?)(?:\s*\(|$)/);
    if (hotelMatch && stops.length > 0) {
      const hotelName = hotelMatch[1].trim();
      const hotel = hotels.find((h) => h.name.toLowerCase() === hotelName.toLowerCase());
      // Apply hotel to all stops at the current destination
      const lastDest = stops[stops.length - 1].destination;
      for (let i = stops.length - 1; i >= 0 && stops[i].destination === lastDest; i--) {
        stops[i].hotel = hotelName;
        stops[i].hotelEmail = hotel?.email;
        stops[i].hotelId = hotel?.id;
      }
      continue;
    }

    // Match transfer lines: "   Transfer in: 150 km / 3.5 h"
    const transferMatch = line.match(/^\s+Transfer in:\s+(.+)/);
    if (transferMatch && stops.length > 0) {
      const lastStopForDest = stops.findLast((s) => !s.transferNote);
      if (lastStopForDest) lastStopForDest.transferNote = transferMatch[1].trim();
      continue;
    }

    // Match activities: "   Activities: Sigiriya Sunrise Climb, Dambulla Cave Temple"
    const actMatch = line.match(/^\s+Activities:\s+(.+)/);
    if (actMatch && stops.length > 0) {
      const acts = actMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
      const lastDest = stops[stops.length - 1].destination;
      // Spread activities across days at this destination
      const daysAtDest = stops.filter((s) => s.destination === lastDest);
      acts.forEach((act, i) => {
        daysAtDest[i % daysAtDest.length].activities.push(act);
      });
    }
  }

  return stops;
}

function parseTransportFromNotes(notes: string): string {
  const match = notes.match(/Transport:\s+(.+)/);
  return match?.[1]?.trim() || "";
}

/* ------------------------------------------------------------------ */
/*  Node 1: Review & Parse Booking                                     */
/* ------------------------------------------------------------------ */

export async function reviewBooking(state: BookingProcessorStateType) {
  const lead = await getLead(state.leadId);
  if (!lead) throw new Error(`Lead ${state.leadId} not found`);

  const hotels = await getHotels();
  const settings = await getAppSettings();
  const companyName = getDisplayCompanyName(settings);
  const itinerary = parseItineraryFromNotes(lead.notes || "", hotels);
  const transportLabel = parseTransportFromNotes(lead.notes || "");

  // Find transport supplier
  const transportSupplier = hotels.find(
    (h) => h.type === "transport" && transportLabel.toLowerCase().includes(h.name.toLowerCase()),
  );

  // Calculate end date
  let endDate = "";
  if (lead.travelDate && itinerary.length > 0) {
    const start = new Date(lead.travelDate);
    start.setDate(start.getDate() + itinerary.length);
    endDate = start.toISOString().slice(0, 10);
  }

  // Build itinerary summary
  const destGroups: { dest: string; nights: number; hotel?: string }[] = [];
  for (const stop of itinerary) {
    const last = destGroups[destGroups.length - 1];
    if (last && last.dest === stop.destination) {
      last.nights++;
      if (stop.hotel) last.hotel = stop.hotel;
    } else {
      destGroups.push({ dest: stop.destination, nights: 1, hotel: stop.hotel });
    }
  }

  const itinerarySummary = destGroups
    .map((g, i) => `${i + 1}. ${g.dest} — ${g.nights} night${g.nights > 1 ? "s" : ""}${g.hotel ? ` at ${g.hotel}` : ""}`)
    .join("\n");

  await createAgentTask({
    threadId: state.threadId,
    nodeName: "reviewBooking",
    taskType: "analysis",
    title: `Booking: ${lead.name} — ${lead.destination || "Sri Lanka"}`,
    description: `${lead.pax} guest(s) · ${lead.travelDate || "TBD"} · ${itinerary.length} night${itinerary.length !== 1 ? "s" : ""} · ${(lead.totalPrice || 0).toLocaleString()} ${lead.totalPrice ? "USD" : ""}\n\nItinerary:\n${itinerarySummary || "No structured route found"}`,
    output: {
      reference: lead.reference, guest: lead.name, email: lead.email,
      pax: lead.pax, travelDate: lead.travelDate, destination: lead.destination,
      stops: destGroups,
    },
  });

  await updateAgentThread(state.threadId, { currentNode: "reviewBooking" });

  return {
    leadReference: lead.reference || "",
    leadName: lead.name,
    leadEmail: lead.email,
    leadPhone: lead.phone || "",
    leadNotes: lead.notes || "",
    destination: lead.destination || "",
    travelDate: lead.travelDate || "",
    endDate,
    pax: lead.pax || 1,
    totalPrice: lead.totalPrice || 0,
    transportLabel,
    transportSupplierEmail: transportSupplier?.email || "",
    transportSupplierId: transportSupplier?.id || "",
    itinerary,
    itinerarySummary,
    companyName,
    companyEmail: settings.company.email || "",
    companyPhone: settings.company.phone || "",
  };
}

/* ------------------------------------------------------------------ */
/*  Node 2: Check Availability                                         */
/* ------------------------------------------------------------------ */

export async function checkAvailability(state: BookingProcessorStateType) {
  const tours = await getTours();
  const warnings: string[] = [];

  if (state.travelDate) {
    const conflicting = tours.filter(
      (t) => t.status === "scheduled" && t.startDate <= state.travelDate && t.endDate >= state.travelDate,
    );
    if (conflicting.length > 0) {
      warnings.push(`${conflicting.length} other tour(s) overlap with travel date ${state.travelDate}`);
    }
  }

  if (state.itinerary.length === 0) {
    warnings.push("No structured itinerary found — manual review recommended");
  }

  const ok = warnings.length === 0;

  await createAgentTask({
    threadId: state.threadId,
    nodeName: "checkAvailability",
    taskType: "availability_check",
    title: "Availability Check",
    description: ok ? "All clear — no scheduling conflicts" : warnings.join("\n"),
    output: { ok, warnings },
  });

  await updateAgentThread(state.threadId, { currentNode: "checkAvailability" });
  return { availabilityOk: ok, availabilityWarnings: warnings };
}

/* ------------------------------------------------------------------ */
/*  Node 3: Draft All Emails                                           */
/* ------------------------------------------------------------------ */

export async function draftEmails(state: BookingProcessorStateType) {
  const sig = `\n\n---\n${state.companyName}\n${state.companyEmail ? `Email: ${state.companyEmail}` : ""}${state.companyPhone ? `\nPhone: ${state.companyPhone}` : ""}\nBooking Reference: ${state.leadReference}`;

  // --- Guest confirmation email ---
  let guestBody = "";
  try {
    const result = await agentGenerateText({
      feature: "booking_processor",
      title: `Guest email: ${state.leadName}`,
      systemPrompt: `You are a warm travel consultant for ${state.companyName}. Write a booking confirmation email. Include the full day-by-day itinerary. Mention hotel names, activities, and transport. End with "We look forward to welcoming you to Sri Lanka!" Do NOT include subject line. Under 400 words.`,
      userPrompt: `Booking confirmation for:\n- Guest: ${state.leadName}\n- Reference: ${state.leadReference}\n- Travel: ${state.travelDate} to ${state.endDate}\n- Guests: ${state.pax}\n- Transport: ${state.transportLabel || "Not selected"}\n- Total: ${state.totalPrice} ${state.currency}\n\nItinerary:\n${state.itinerarySummary}\n\nFull notes:\n${state.leadNotes}`,
    });
    guestBody = result.text + sig;
  } catch {
    guestBody = `Dear ${state.leadName},\n\nThank you for booking with ${state.companyName}!\n\nBooking Reference: ${state.leadReference}\nTravel Dates: ${state.travelDate} to ${state.endDate}\nGuests: ${state.pax}\nTotal: ${state.totalPrice} ${state.currency}\n\nYour Itinerary:\n${state.itinerarySummary}\n\nTransport: ${state.transportLabel || "Not selected"}\n\nOur team will confirm all reservations and get back to you within 24 hours.${sig}`;
  }

  const guestSubject = `Booking Confirmed — ${state.destination || "Sri Lanka"} | Ref: ${state.leadReference}`;

  // --- Supplier reservation emails ---
  const supplierEmails: SupplierEmail[] = [];
  const hotelGroups = new Map<string, { hotelName: string; email: string; nights: number; checkIn: string; checkOut: string }>();

  for (let i = 0; i < state.itinerary.length; i++) {
    const stop = state.itinerary[i];
    if (!stop.hotel || !stop.hotelEmail) continue;
    const key = stop.hotel;
    const existing = hotelGroups.get(key);
    if (existing) {
      existing.nights++;
      // Extend checkout
      if (state.travelDate) {
        const co = new Date(state.travelDate);
        co.setDate(co.getDate() + i + 1);
        existing.checkOut = co.toISOString().slice(0, 10);
      }
    } else {
      let checkIn = "";
      let checkOut = "";
      if (state.travelDate) {
        const ci = new Date(state.travelDate);
        ci.setDate(ci.getDate() + i);
        checkIn = ci.toISOString().slice(0, 10);
        const co = new Date(ci);
        co.setDate(co.getDate() + 1);
        checkOut = co.toISOString().slice(0, 10);
      }
      hotelGroups.set(key, { hotelName: stop.hotel, email: stop.hotelEmail, nights: 1, checkIn, checkOut });
    }
  }

  for (const [, hotel] of hotelGroups) {
    const rooms = Math.ceil(state.pax / 2);
    supplierEmails.push({
      type: "hotel",
      supplierName: hotel.hotelName,
      supplierEmail: hotel.email,
      subject: `Reservation Request — ${state.leadName} | ${hotel.checkIn} to ${hotel.checkOut} | Ref: ${state.leadReference}`,
      body: `Dear ${hotel.hotelName} Reservations,\n\nWe would like to request a reservation with the following details:\n\nGuest Name: ${state.leadName}\nBooking Reference: ${state.leadReference}\nCheck-in: ${hotel.checkIn}\nCheck-out: ${hotel.checkOut}\nNights: ${hotel.nights}\nRooms Required: ${rooms}\nNumber of Guests: ${state.pax}\n${state.leadPhone ? `Guest Phone: ${state.leadPhone}\n` : ""}\nPlease confirm availability and rate at your earliest convenience.\n\nThank you for your continued partnership.${sig}`,
    });
  }

  // Transport supplier email
  if (state.transportLabel && state.transportSupplierEmail) {
    supplierEmails.push({
      type: "transport",
      supplierName: state.transportLabel,
      supplierEmail: state.transportSupplierEmail,
      subject: `Vehicle Reservation — ${state.leadName} | ${state.travelDate} to ${state.endDate} | Ref: ${state.leadReference}`,
      body: `Dear ${state.transportLabel},\n\nWe would like to reserve a vehicle for the following booking:\n\nGuest Name: ${state.leadName}\nBooking Reference: ${state.leadReference}\nPickup Date: ${state.travelDate}\nDrop-off Date: ${state.endDate}\nDuration: ${state.itinerary.length} days\nNumber of Passengers: ${state.pax}\nRoute: ${state.destination}\n\nItinerary:\n${state.itinerarySummary}\n\nPlease confirm availability.${sig}`,
    });
  }

  // Create tasks for each email
  await createAgentTask({
    threadId: state.threadId,
    nodeName: "draftEmails",
    taskType: "draft_email",
    title: `Guest Confirmation Email`,
    description: `To: ${state.leadEmail}`,
    proposedAction: { type: "guest_email", to: state.leadEmail, subject: guestSubject, body: guestBody },
    status: "pending",
  });

  for (const se of supplierEmails) {
    await createAgentTask({
      threadId: state.threadId,
      nodeName: "draftEmails",
      taskType: "draft_email",
      title: `${se.type === "hotel" ? "Hotel" : "Transport"} Reservation: ${se.supplierName}`,
      description: `To: ${se.supplierEmail}`,
      proposedAction: { ...se, type: "supplier_email", supplierType: se.type },
      status: "pending",
    });
  }

  await updateAgentThread(state.threadId, {
    currentNode: "draftEmails",
    status: "awaiting_approval",
    summary: `${state.leadName} — ${state.destination} — ${state.pax} pax — ${state.itinerary.length} nights — ${state.totalPrice} ${state.currency}\n${supplierEmails.length} supplier email(s) + 1 guest confirmation ready for review`,
  });

  return { guestEmailSubject: guestSubject, guestEmailBody: guestBody, supplierEmails };
}

/* ------------------------------------------------------------------ */
/*  Node 4: Execute Decision (after admin approval)                    */
/* ------------------------------------------------------------------ */

export async function executeDecision(state: BookingProcessorStateType) {
  if (state.adminDecision !== "approved") {
    await updateAgentThread(state.threadId, {
      status: "rejected",
      summary: `Rejected by admin${state.adminNotes ? `: ${state.adminNotes}` : ""}`,
      result: { decision: "rejected", notes: state.adminNotes },
    });
    return {};
  }

  const results: string[] = [];

  // 1. Update lead status to confirmed
  try {
    await updateLead(state.leadId, { status: "won" });
    results.push("Lead status → won");
  } catch (err) {
    debugLog("Agent: lead update failed", { error: err instanceof Error ? err.message : String(err) });
    results.push("Lead update failed");
  }

  // 2. Schedule tour
  try {
    const { scheduleTourFromLeadAction } = await import("@/app/actions/tours");
    const tourResult = await scheduleTourFromLeadAction(state.leadId, state.travelDate || undefined);
    if (tourResult?.error) {
      results.push(`Tour scheduling: ${tourResult.error}`);
    } else {
      results.push("Tour scheduled in calendar");
    }
  } catch (err) {
    debugLog("Agent: tour scheduling failed", { error: err instanceof Error ? err.message : String(err) });
    results.push("Tour scheduling failed — schedule manually");
  }

  // 3. Send emails via Resend
  if (isEmailConfigured()) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const settings = await getAppSettings();
    const companyName = getDisplayCompanyName(settings);
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || `${companyName} <onboarding@resend.dev>`;

    // Guest confirmation
    try {
      await resend.emails.send({
        from: fromEmail,
        to: [state.leadEmail],
        subject: state.guestEmailSubject,
        text: state.guestEmailBody,
      });
      results.push(`Guest email sent to ${state.leadEmail}`);
    } catch (err) {
      debugLog("Agent: guest email failed", { error: err instanceof Error ? err.message : String(err) });
      results.push(`Guest email failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }

    // Supplier emails
    for (const se of state.supplierEmails) {
      try {
        await resend.emails.send({
          from: fromEmail,
          to: [se.supplierEmail],
          subject: se.subject,
          text: se.body,
        });
        results.push(`${se.type === "hotel" ? "Hotel" : "Transport"} email sent to ${se.supplierName} (${se.supplierEmail})`);
      } catch (err) {
        debugLog(`Agent: supplier email failed for ${se.supplierName}`, { error: err instanceof Error ? err.message : String(err) });
        results.push(`${se.supplierName} email failed`);
      }
    }
  } else {
    results.push("Email not configured (RESEND_API_KEY missing) — emails skipped");
  }

  await createAgentTask({
    threadId: state.threadId,
    nodeName: "executeDecision",
    taskType: "analysis",
    title: "Execution Results",
    description: results.join("\n"),
    output: { results },
    status: "executed",
  });

  await updateAgentThread(state.threadId, {
    status: "completed",
    summary: `Approved & executed — ${state.leadName} (${state.destination})\n${results.join(" · ")}`,
    result: {
      decision: "approved",
      results,
      emailsSent: results.filter((r) => r.includes("sent to")).length,
      itineraryNights: state.itinerary.length,
    },
  });

  return {};
}
