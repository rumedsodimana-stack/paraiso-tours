/**
 * Generate a day-by-day itinerary PDF for a scheduled tour.
 * Uses the package snapshot if present (frozen at scheduling time), otherwise
 * the live package. Includes the letterhead, trip summary, and an itinerary
 * table with per-day accommodation and narrative.
 */

import { getAppSettings, getDisplayCompanyName } from "./app-config";
import type {
  ItineraryDay,
  Tour,
  TourPackage,
  PackageSnapshot,
} from "./types";

interface ItineraryInput {
  tour: Tour;
  pkg: TourPackage | null;
  lead?: {
    name?: string;
    email?: string;
    phone?: string;
    reference?: string;
  } | null;
}

function pickItinerary(
  snapshot: PackageSnapshot | undefined,
  pkg: TourPackage | null
): { days: ItineraryDay[]; inclusions: string[]; exclusions: string[]; destination: string; description: string } {
  const s = snapshot ?? null;
  return {
    days: s?.itinerary ?? pkg?.itinerary ?? [],
    inclusions: s?.inclusions ?? pkg?.inclusions ?? [],
    exclusions: s?.exclusions ?? pkg?.exclusions ?? [],
    destination: s?.destination ?? pkg?.destination ?? "",
    description: s?.description ?? pkg?.description ?? "",
  };
}

function formatLongDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export async function generateItineraryPdf(input: ItineraryInput): Promise<Buffer> {
  const { tour, pkg, lead } = input;
  const settings = await getAppSettings();
  const letterhead = {
    companyName: getDisplayCompanyName(settings),
    tagline: settings.company.tagline || "",
    address: settings.company.address || "",
    phone: settings.company.phone || "",
    email: settings.company.email || "",
  };
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "mm" });

  const PAGE_W = 210;
  const MARGIN_L = 20;
  const MARGIN_R = 20;
  const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
  const PAGE_BOTTOM = 280;
  let y = 18;

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage();
      y = 18;
    }
  }

  // Letterhead
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(letterhead.companyName, MARGIN_L, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (letterhead.tagline) {
    doc.text(letterhead.tagline, MARGIN_L, y);
    y += 5;
  }
  const contactLine = [letterhead.address, letterhead.phone, letterhead.email]
    .filter(Boolean)
    .join(" | ");
  if (contactLine) {
    doc.text(contactLine, MARGIN_L, y);
    y += 5;
  }
  y += 6;

  // Title + reference
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text("TOUR ITINERARY", MARGIN_L, y);
  y += 5;

  doc.setTextColor(24, 24, 27);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(tour.packageName, MARGIN_L, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (tour.confirmationId) {
    doc.text(`Confirmation: ${tour.confirmationId}`, MARGIN_L, y);
    y += 5;
  }
  if (lead?.reference) {
    doc.text(`Reference: ${lead.reference}`, MARGIN_L, y);
    y += 5;
  }

  y += 4;

  // Summary box
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, 32, 3, 3, "S");
  const colLeft = MARGIN_L + 4;
  const colRight = MARGIN_L + CONTENT_W / 2 + 4;
  let boxY = y + 6;
  doc.setFont("helvetica", "bold");
  doc.text("Guest", colLeft, boxY);
  doc.text("Travel window", colRight, boxY);
  boxY += 5;
  doc.setFont("helvetica", "normal");
  doc.text(tour.clientName || lead?.name || "—", colLeft, boxY);
  doc.text(
    `${formatLongDate(tour.startDate)}`,
    colRight,
    boxY
  );
  boxY += 5;
  doc.text(
    `${tour.pax} ${tour.pax === 1 ? "guest" : "guests"}`,
    colLeft,
    boxY
  );
  doc.text(`to ${formatLongDate(tour.endDate)}`, colRight, boxY);
  boxY += 5;
  if (lead?.email) {
    doc.text(lead.email, colLeft, boxY);
  }
  y += 40;

  // Description
  const details = pickItinerary(tour.packageSnapshot, pkg);
  if (details.destination) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.text("Destination", MARGIN_L, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(details.destination, CONTENT_W);
    doc.text(wrapped, MARGIN_L, y);
    y += wrapped.length * 5 + 3;
  }
  if (details.description) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.text("Overview", MARGIN_L, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(details.description, CONTENT_W);
    doc.text(wrapped, MARGIN_L, y);
    y += wrapped.length * 5 + 4;
  }

  // Day-by-day
  if (details.days.length > 0) {
    ensureSpace(12);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Day by day", MARGIN_L, y);
    y += 6;
    doc.setFontSize(10);

    for (const day of details.days) {
      ensureSpace(14);
      doc.setFont("helvetica", "bold");
      const header = `Day ${day.day} — ${day.title || ""}`.trim().replace(/—\s*$/, "");
      doc.text(header, MARGIN_L, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      if (day.description) {
        const wrapped = doc.splitTextToSize(day.description, CONTENT_W);
        ensureSpace(wrapped.length * 5 + 2);
        doc.text(wrapped, MARGIN_L, y);
        y += wrapped.length * 5 + 2;
      }
      if (day.accommodation) {
        ensureSpace(6);
        doc.setTextColor(107, 114, 128);
        doc.text(`Accommodation: ${day.accommodation}`, MARGIN_L, y);
        doc.setTextColor(24, 24, 27);
        y += 5;
      }
      y += 2;
    }
  }

  // Inclusions / Exclusions
  if (details.inclusions.length > 0) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.text("Inclusions", MARGIN_L, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const item of details.inclusions) {
      const wrapped = doc.splitTextToSize(`• ${item}`, CONTENT_W);
      ensureSpace(wrapped.length * 5);
      doc.text(wrapped, MARGIN_L, y);
      y += wrapped.length * 5;
    }
    y += 3;
  }
  if (details.exclusions.length > 0) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.text("Exclusions", MARGIN_L, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const item of details.exclusions) {
      const wrapped = doc.splitTextToSize(`• ${item}`, CONTENT_W);
      ensureSpace(wrapped.length * 5);
      doc.text(wrapped, MARGIN_L, y);
      y += wrapped.length * 5;
    }
  }

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
