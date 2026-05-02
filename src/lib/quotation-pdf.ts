/**
 * Generate a branded PDF for a corporate / custom-tour quotation.
 * Same brand kit as invoice-pdf.ts and itinerary-pdf.ts via
 * lib/pdf-letterhead.ts so guests, finance teams, and corporate
 * clients see one consistent identity across every artifact.
 *
 * Layout:
 *   1. Coloured navy header band with QUOTATION kicker
 *   2. Title + reference + status pill (Draft / Sent / Accepted / Rejected)
 *   3. Two cards: "For" (company + contact) + "Trip details"
 *      (destination, duration, pax, travel date)
 *   4. Optional itinerary block (day-by-day cards)
 *   5. Inclusions / Exclusions in two-column lists
 *   6. Line items table with quantity + unit price + line total
 *   7. Subtotal, optional discount line, gold-tinted Total band
 *   8. Optional Terms & conditions + Notes + Valid-until banner
 *   9. Italic gold sign-off
 *  10. Footer (drawn via finalizeBrandedDoc)
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
  Quotation,
  QuotationLineItem,
  QuotationStatus,
} from "./types";

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
  return [c.r, c.g, c.b];
}

function statusPill(status: QuotationStatus): {
  label: string;
  fill: { r: number; g: number; b: number };
  text: { r: number; g: number; b: number };
} {
  switch (status) {
    case "accepted":
      return {
        label: "ACCEPTED",
        fill: { r: 220, g: 252, b: 231 },
        text: { r: 4, g: 120, b: 87 },
      };
    case "rejected":
      return {
        label: "REJECTED",
        fill: { r: 254, g: 226, b: 226 },
        text: { r: 159, g: 18, b: 57 },
      };
    case "sent":
      return {
        label: "SENT",
        fill: { r: 219, g: 234, b: 254 },
        text: { r: 30, g: 64, b: 175 },
      };
    case "draft":
    default:
      return {
        label: "DRAFT",
        fill: { r: 243, g: 244, b: 246 },
        text: { r: 75, g: 85, b: 99 },
      };
  }
}

function formatLongDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export async function generateQuotationPdf(
  quotation: Quotation
): Promise<Buffer> {
  const ctx = await initBrandedDoc();
  const { doc } = ctx;

  drawHeaderBand(ctx, "Quotation");

  // ── Title row: reference + status pill ─────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(quotation.reference, PAGE.MARGIN_L, ctx.y);

  const status = statusPill(quotation.status);
  doc.setFontSize(8);
  const labelW = doc.getTextWidth(status.label) + 6;
  const pillX = PAGE.W - PAGE.MARGIN_R - labelW;
  const pillY = ctx.y - 5;
  doc.setFillColor(...rgb(status.fill));
  doc.roundedRect(pillX, pillY, labelW, 6, 1.5, 1.5, "F");
  doc.setTextColor(...rgb(status.text));
  doc.text(status.label, pillX + labelW / 2, pillY + 4, { align: "center" });
  ctx.y += 7;

  // Document title (custom title or fallback to "Custom Sri Lanka journey")
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...rgb(BRAND.ink));
  const title = quotation.title?.trim() || "Custom Sri Lanka journey";
  const wrappedTitle = doc.splitTextToSize(title, CONTENT_W);
  doc.text(wrappedTitle, PAGE.MARGIN_L, ctx.y);
  ctx.y += wrappedTitle.length * 5.2 + 2;

  // Meta line: issued + valid-until
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  const metaBits: string[] = [`Issued ${formatLongDate(quotation.createdAt)}`];
  if (quotation.validUntil) {
    metaBits.push(`Valid until ${formatLongDate(quotation.validUntil)}`);
  }
  doc.text(metaBits.join("   ·   "), PAGE.MARGIN_L, ctx.y);
  ctx.y += 8;

  // ── "For" + "Trip details" cards ───────────────────────────────
  const cardW = (CONTENT_W - 4) / 2;
  const cardH = 36;
  const cardY = ctx.y;
  doc.setDrawColor(...rgb(BRAND.border));
  doc.setFillColor(...rgb(BRAND.cream));
  doc.roundedRect(PAGE.MARGIN_L, cardY, cardW, cardH, 2, 2, "FD");
  doc.roundedRect(PAGE.MARGIN_L + cardW + 4, cardY, cardW, cardH, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text("FOR", PAGE.MARGIN_L + 4, cardY + 5);
  doc.text("TRIP DETAILS", PAGE.MARGIN_L + cardW + 8, cardY + 5);

  // Left card: company / contact / email / phone
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  let leftY = cardY + 11;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(
    quotation.companyName || quotation.contactName,
    PAGE.MARGIN_L + 4,
    leftY
  );
  leftY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  if (quotation.companyName && quotation.contactName) {
    doc.text(`Attn: ${quotation.contactName}`, PAGE.MARGIN_L + 4, leftY);
    leftY += 4.5;
  }
  if (quotation.contactEmail) {
    doc.text(quotation.contactEmail, PAGE.MARGIN_L + 4, leftY);
    leftY += 4.5;
  }
  if (quotation.contactPhone) {
    doc.text(quotation.contactPhone, PAGE.MARGIN_L + 4, leftY);
  }

  // Right card: destination / duration / pax / travel date
  let rightY = cardY + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.ink));
  if (quotation.destination) {
    doc.text(quotation.destination, PAGE.MARGIN_L + cardW + 8, rightY);
    rightY += 5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  if (quotation.duration) {
    doc.text(quotation.duration, PAGE.MARGIN_L + cardW + 8, rightY);
    rightY += 4.5;
  }
  doc.text(
    `${quotation.pax} ${quotation.pax === 1 ? "traveller" : "travellers"}`,
    PAGE.MARGIN_L + cardW + 8,
    rightY
  );
  rightY += 4.5;
  if (quotation.travelDate) {
    doc.text(
      `Travel ${formatLongDate(quotation.travelDate)}`,
      PAGE.MARGIN_L + cardW + 8,
      rightY
    );
  }

  ctx.y = cardY + cardH + 9;

  // ── Day-by-day itinerary (optional) ────────────────────────────
  if (quotation.itinerary.length > 0) {
    drawSectionHeading(ctx, "Day by day");
    for (const day of quotation.itinerary) {
      renderDayCard(ctx, day);
    }
    ctx.y += 2;
  }

  // ── Inclusions / Exclusions ────────────────────────────────────
  const inclusions = quotation.inclusions ?? [];
  const exclusions = quotation.exclusions ?? [];
  if (inclusions.length > 0 || exclusions.length > 0) {
    drawSectionHeading(ctx, "What's included");
    const colW = (CONTENT_W - 6) / 2;
    const startY = ctx.y;
    let leftEnd = startY;
    let rightEnd = startY;

    if (inclusions.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...rgb(BRAND.gold));
      doc.text("INCLUSIONS", PAGE.MARGIN_L, leftEnd);
      leftEnd += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...rgb(BRAND.ink));
      for (const item of inclusions) {
        const wrapped = doc.splitTextToSize(`✓  ${item}`, colW);
        doc.text(wrapped, PAGE.MARGIN_L, leftEnd);
        leftEnd += wrapped.length * 4.5 + 0.5;
      }
    }

    if (exclusions.length > 0) {
      const xCol = PAGE.MARGIN_L + colW + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...rgb(BRAND.gold));
      doc.text("EXCLUSIONS", xCol, rightEnd);
      rightEnd += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...rgb(BRAND.inkSoft));
      for (const item of exclusions) {
        const wrapped = doc.splitTextToSize(`–  ${item}`, colW);
        doc.text(wrapped, xCol, rightEnd);
        rightEnd += wrapped.length * 4.5 + 0.5;
      }
    }

    ctx.y = Math.max(leftEnd, rightEnd) + 4;
  }

  // ── Line items + pricing ───────────────────────────────────────
  drawSectionHeading(ctx, "Pricing");

  const COL_DESC = PAGE.MARGIN_L;
  const COL_QTY = PAGE.MARGIN_L + CONTENT_W * 0.55;
  const COL_UNIT = PAGE.MARGIN_L + CONTENT_W * 0.72;
  const COL_TOTAL = PAGE.W - PAGE.MARGIN_R;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text("DESCRIPTION", COL_DESC, ctx.y);
  doc.text("QTY", COL_QTY, ctx.y, { align: "right" });
  doc.text("UNIT", COL_UNIT, ctx.y, { align: "right" });
  doc.text("LINE TOTAL", COL_TOTAL, ctx.y, { align: "right" });
  ctx.y += 2;
  doc.setDrawColor(...rgb(BRAND.gold));
  doc.setLineWidth(0.4);
  doc.line(PAGE.MARGIN_L, ctx.y, PAGE.W - PAGE.MARGIN_R, ctx.y);
  doc.setLineWidth(0.2);
  doc.setDrawColor(...rgb(BRAND.border));
  ctx.y += 5;

  doc.setTextColor(...rgb(BRAND.ink));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  quotation.lineItems.forEach((li, idx) => {
    renderLineItem(ctx, li, quotation.currency, idx);
  });

  ctx.y += 2;

  // Subtotal
  ensureSpace(ctx, 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  doc.text("Subtotal", COL_DESC, ctx.y);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(
    `${quotation.subtotal.toLocaleString()} ${quotation.currency}`,
    COL_TOTAL,
    ctx.y,
    { align: "right" }
  );
  ctx.y += 6;

  // Optional discount line
  if (quotation.discountAmount && quotation.discountAmount !== 0) {
    ensureSpace(ctx, 7);
    doc.setTextColor(...rgb(BRAND.inkSoft));
    doc.text("Discount", COL_DESC, ctx.y);
    doc.setTextColor(...rgb(BRAND.rose));
    doc.text(
      `−${Math.abs(quotation.discountAmount).toLocaleString()} ${quotation.currency}`,
      COL_TOTAL,
      ctx.y,
      { align: "right" }
    );
    ctx.y += 6;
  }

  // Gold-tinted Total band
  ensureSpace(ctx, 16);
  doc.setFillColor(...rgb(BRAND.goldSoft));
  doc.roundedRect(PAGE.MARGIN_L - 2, ctx.y - 5, CONTENT_W + 4, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text("Total", PAGE.MARGIN_L + 2, ctx.y + 3);
  doc.setFontSize(15);
  doc.setTextColor(...rgb(BRAND.teal));
  doc.text(
    `${quotation.totalAmount.toLocaleString()} ${quotation.currency}`,
    COL_TOTAL - 2,
    ctx.y + 4,
    { align: "right" }
  );
  ctx.y += 18;

  // ── Terms & Conditions ─────────────────────────────────────────
  if (quotation.termsAndConditions && quotation.termsAndConditions.trim()) {
    drawSectionHeading(ctx, "Terms & conditions");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(BRAND.inkSoft));
    const wrapped = doc.splitTextToSize(
      quotation.termsAndConditions.trim(),
      CONTENT_W
    );
    ensureSpace(ctx, wrapped.length * 4 + 2);
    doc.text(wrapped, PAGE.MARGIN_L, ctx.y);
    ctx.y += wrapped.length * 4 + 2;
  }

  // ── Notes ──────────────────────────────────────────────────────
  if (quotation.notes && quotation.notes.trim()) {
    ensureSpace(ctx, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(BRAND.ink));
    doc.text("Notes", PAGE.MARGIN_L, ctx.y);
    ctx.y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...rgb(BRAND.inkSoft));
    const wrapped = doc.splitTextToSize(quotation.notes.trim(), CONTENT_W);
    doc.text(wrapped, PAGE.MARGIN_L, ctx.y);
    ctx.y += wrapped.length * 4.5;
  }

  // ── Closing italic gold line ───────────────────────────────────
  ensureSpace(ctx, 12);
  ctx.y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text(
    "Reply to this quotation to accept, request changes, or ask anything.",
    PAGE.W / 2,
    ctx.y,
    { align: "center" }
  );

  finalizeBrandedDoc(ctx);
  return brandedDocToBuffer(ctx);
}

// ── Helpers ─────────────────────────────────────────────────────

function renderDayCard(
  ctx: Awaited<ReturnType<typeof initBrandedDoc>>,
  day: ItineraryDay
): void {
  const { doc } = ctx;
  const headerLine = `Day ${day.day}${day.title ? `  ·  ${day.title}` : ""}`;
  const wrappedDesc = day.description
    ? doc.splitTextToSize(day.description, CONTENT_W - 10)
    : [];
  const accomLine = day.accommodation ? 1 : 0;
  const cardH =
    4 +
    5 +
    wrappedDesc.length * 4.5 +
    accomLine * 6 +
    4;
  ensureSpace(ctx, cardH + 3);

  const dayY = ctx.y;
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

function renderLineItem(
  ctx: Awaited<ReturnType<typeof initBrandedDoc>>,
  li: QuotationLineItem,
  currency: string,
  rowIdx: number
): void {
  const { doc } = ctx;
  ensureSpace(ctx, 8);

  const COL_DESC = PAGE.MARGIN_L;
  const COL_QTY = PAGE.MARGIN_L + CONTENT_W * 0.55;
  const COL_UNIT = PAGE.MARGIN_L + CONTENT_W * 0.72;
  const COL_TOTAL = PAGE.W - PAGE.MARGIN_R;

  // Zebra row fill
  if (rowIdx % 2 === 0) {
    doc.setFillColor(...rgb(BRAND.cream));
    doc.rect(PAGE.MARGIN_L - 2, ctx.y - 4, CONTENT_W + 4, 7, "F");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(BRAND.ink));
  const labelText = li.notes ? `${li.label}  —  ${li.notes}` : li.label;
  const wrapped = doc.splitTextToSize(labelText, CONTENT_W * 0.5);
  doc.text(wrapped, COL_DESC, ctx.y);

  doc.text(String(li.quantity), COL_QTY, ctx.y, { align: "right" });
  doc.text(
    `${li.unitPrice.toLocaleString()} ${currency}`,
    COL_UNIT,
    ctx.y,
    { align: "right" }
  );
  doc.setFont("helvetica", "bold");
  doc.text(
    `${li.total.toLocaleString()} ${currency}`,
    COL_TOTAL,
    ctx.y,
    { align: "right" }
  );
  doc.setFont("helvetica", "normal");
  ctx.y += Math.max(7, wrapped.length * 4.5 + 2);
}
