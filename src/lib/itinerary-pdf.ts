/**
 * Generate a branded day-by-day itinerary PDF for a scheduled tour.
 * Uses the package snapshot if present (frozen at scheduling time),
 * otherwise the live package. Shares letterhead + footer styling
 * with the invoice PDF via lib/pdf-letterhead.ts.
 *
 * Layout:
 *   1. Coloured teal header band with TOUR ITINERARY kicker
 *   2. Package title + confirmation/reference IDs
 *   3. Trip-summary card (guest, dates, pax, contact)
 *   4. Optional destination + overview blurbs
 *   5. Day cards — gold left-rule, day number, title, narrative,
 *      accommodation pill
 *   6. Inclusions / Exclusions in two-column lists
 *   7. Footer (drawn via finalizeBrandedDoc) with company + page count
 */

import {
  BRAND,
  PAGE,
  CONTENT_W,
  brandedDocToBuffer,
  drawHeaderBand,
  drawSectionHeading,
  ensureSpace,
  finalizeBrandedDoc,
  initBrandedDoc,
} from "./pdf-letterhead";
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

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
  return [c.r, c.g, c.b];
}

function pickItinerary(
  snapshot: PackageSnapshot | undefined,
  pkg: TourPackage | null
): {
  days: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  destination: string;
  description: string;
} {
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

export async function generateItineraryPdf(
  input: ItineraryInput
): Promise<Buffer> {
  const { tour, pkg, lead } = input;
  const ctx = await initBrandedDoc();
  const { doc } = ctx;

  drawHeaderBand(ctx, "Tour Itinerary");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...rgb(BRAND.ink));
  const wrappedTitle = doc.splitTextToSize(tour.packageName, CONTENT_W);
  doc.text(wrappedTitle, PAGE.MARGIN_L, ctx.y);
  ctx.y += wrappedTitle.length * 7;

  // Reference IDs (confirmation + booking ref)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  const refBits: string[] = [];
  if (tour.confirmationId) refBits.push(`Confirmation ${tour.confirmationId}`);
  if (lead?.reference) refBits.push(`Booking ${lead.reference}`);
  if (refBits.length > 0) {
    doc.text(refBits.join("   ·   "), PAGE.MARGIN_L, ctx.y);
    ctx.y += 7;
  } else {
    ctx.y += 2;
  }

  // Trip summary card with cream fill + gold left rule.
  const cardY = ctx.y;
  const cardH = 36;
  doc.setFillColor(...rgb(BRAND.cream));
  doc.setDrawColor(...rgb(BRAND.border));
  doc.roundedRect(PAGE.MARGIN_L, cardY, CONTENT_W, cardH, 2, 2, "FD");
  // Gold left rule
  doc.setFillColor(...rgb(BRAND.gold));
  doc.rect(PAGE.MARGIN_L, cardY, 2, cardH, "F");

  const colLeft = PAGE.MARGIN_L + 8;
  const colRight = PAGE.MARGIN_L + CONTENT_W / 2 + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text("GUEST", colLeft, cardY + 6);
  doc.text("TRAVEL WINDOW", colRight, cardY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(BRAND.ink));
  let leftY = cardY + 12;
  doc.setFont("helvetica", "bold");
  doc.text(tour.clientName || lead?.name || "Guest", colLeft, leftY);
  leftY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  doc.text(
    `${tour.pax} ${tour.pax === 1 ? "guest" : "guests"}`,
    colLeft,
    leftY
  );
  leftY += 4.5;
  if (lead?.email) {
    doc.text(lead.email, colLeft, leftY);
    leftY += 4.5;
  }
  if (lead?.phone) {
    doc.text(lead.phone, colLeft, leftY);
  }

  let rightY = cardY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(`Arrives ${formatLongDate(tour.startDate)}`, colRight, rightY);
  rightY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  doc.text(`Departs ${formatLongDate(tour.endDate)}`, colRight, rightY);

  ctx.y = cardY + cardH + 9;

  const details = pickItinerary(tour.packageSnapshot, pkg);

  // Optional destination / overview blurbs.
  if (details.destination) {
    drawSectionHeading(ctx, "Destination");
    doc.setTextColor(...rgb(BRAND.ink));
    const wrapped = doc.splitTextToSize(details.destination, CONTENT_W);
    ensureSpace(ctx, wrapped.length * 4.5 + 3);
    doc.text(wrapped, PAGE.MARGIN_L, ctx.y);
    ctx.y += wrapped.length * 4.5 + 3;
  }

  if (details.description) {
    drawSectionHeading(ctx, "Overview");
    doc.setTextColor(...rgb(BRAND.ink));
    const wrapped = doc.splitTextToSize(details.description, CONTENT_W);
    ensureSpace(ctx, wrapped.length * 4.5 + 3);
    doc.text(wrapped, PAGE.MARGIN_L, ctx.y);
    ctx.y += wrapped.length * 4.5 + 4;
  }

  // Day-by-day cards.
  if (details.days.length > 0) {
    drawSectionHeading(ctx, "Day by day");
    for (const day of details.days) {
      // Predict card height so the rule + content stay together.
      const headerLine = `Day ${day.day}${day.title ? `  ·  ${day.title}` : ""}`;
      const wrappedDesc = day.description
        ? doc.splitTextToSize(day.description, CONTENT_W - 10)
        : [];
      const accomLine = day.accommodation ? 1 : 0;
      const cardH =
        4 /* top pad */ +
        5 /* header */ +
        wrappedDesc.length * 4.5 +
        accomLine * 6 +
        4; /* bottom pad */
      ensureSpace(ctx, cardH + 3);

      const dayY = ctx.y;
      // Gold left rule
      doc.setFillColor(...rgb(BRAND.gold));
      doc.rect(PAGE.MARGIN_L, dayY, 1.5, cardH - 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...rgb(BRAND.teal));
      doc.text(headerLine, PAGE.MARGIN_L + 6, dayY + 5);

      let inner = dayY + 11;
      if (wrappedDesc.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...rgb(BRAND.ink));
        doc.text(wrappedDesc, PAGE.MARGIN_L + 6, inner);
        inner += wrappedDesc.length * 4.5 + 1;
      }
      if (day.accommodation) {
        // Accommodation pill — beige background, gold ink.
        doc.setFillColor(...rgb(BRAND.beige));
        const labelText = `Accommodation: ${day.accommodation}`;
        const w =
          doc.getTextWidth(labelText) + 6 < CONTENT_W - 6
            ? doc.getTextWidth(labelText) + 6
            : CONTENT_W - 6;
        doc.roundedRect(PAGE.MARGIN_L + 6, inner, w, 5, 1.2, 1.2, "F");
        doc.setFontSize(8.5);
        doc.setTextColor(...rgb(BRAND.gold));
        doc.text(labelText, PAGE.MARGIN_L + 9, inner + 3.5);
      }
      ctx.y = dayY + cardH + 1;
    }
  }

  // Inclusions / Exclusions — side-by-side when both fit, stacked otherwise.
  if (details.inclusions.length > 0 || details.exclusions.length > 0) {
    drawSectionHeading(ctx, "What's included");
    const colW = (CONTENT_W - 6) / 2;
    const startY = ctx.y;
    let leftEnd = startY;
    let rightEnd = startY;

    if (details.inclusions.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...rgb(BRAND.gold));
      doc.text("INCLUSIONS", PAGE.MARGIN_L, leftEnd);
      leftEnd += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...rgb(BRAND.ink));
      for (const item of details.inclusions) {
        const wrapped = doc.splitTextToSize(`✓  ${item}`, colW);
        doc.text(wrapped, PAGE.MARGIN_L, leftEnd);
        leftEnd += wrapped.length * 4.5 + 0.5;
      }
    }

    if (details.exclusions.length > 0) {
      const xCol = PAGE.MARGIN_L + colW + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...rgb(BRAND.gold));
      doc.text("EXCLUSIONS", xCol, rightEnd);
      rightEnd += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...rgb(BRAND.inkSoft));
      for (const item of details.exclusions) {
        const wrapped = doc.splitTextToSize(`–  ${item}`, colW);
        doc.text(wrapped, xCol, rightEnd);
        rightEnd += wrapped.length * 4.5 + 0.5;
      }
    }

    ctx.y = Math.max(leftEnd, rightEnd) + 4;
  }

  // Closing line
  ensureSpace(ctx, 12);
  ctx.y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text(
    "Reach out anytime — we're here to make your trip unforgettable.",
    PAGE.W / 2,
    ctx.y,
    { align: "center" }
  );

  finalizeBrandedDoc(ctx);
  return brandedDocToBuffer(ctx);
}
