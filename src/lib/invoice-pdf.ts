/**
 * Generate a branded PDF invoice for email attachment + admin download.
 * Uses the shared letterhead helpers (lib/pdf-letterhead.ts) so the
 * look matches every other document the system emits.
 *
 * Layout:
 *   1. Coloured teal header band with logo + company info + INVOICE kicker
 *   2. Invoice number + issued date + status pill
 *   3. Two-column "Bill to" + "Booking details" cards
 *   4. Line-items table with zebra rows
 *   5. Total row in a gold band for emphasis
 *   6. Payment terms + notes
 *   7. Footer (drawn via finalizeBrandedDoc) with company name + page count
 */

import {
  BRAND,
  PAGE,
  CONTENT_W,
  brandedDocToBuffer,
  drawHeaderBand,
  ensureSpace,
  finalizeBrandedDoc,
  initBrandedDoc,
} from "./pdf-letterhead";
import type { Invoice } from "./types";

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
  return [c.r, c.g, c.b];
}

function statusPill(status: Invoice["status"]): {
  label: string;
  fill: { r: number; g: number; b: number };
  text: { r: number; g: number; b: number };
} {
  switch (status) {
    case "paid":
      return {
        label: "PAID",
        fill: { r: 220, g: 252, b: 231 },
        text: { r: 4, g: 120, b: 87 },
      };
    case "overdue":
      return {
        label: "OVERDUE",
        fill: { r: 254, g: 226, b: 226 },
        text: { r: 159, g: 18, b: 57 },
      };
    case "cancelled":
      return {
        label: "CANCELLED",
        fill: { r: 243, g: 244, b: 246 },
        text: { r: 75, g: 85, b: 99 },
      };
    case "pending_payment":
    default:
      return {
        label: "PENDING PAYMENT",
        fill: { r: 254, g: 243, b: 199 },
        text: { r: 146, g: 64, b: 14 },
      };
  }
}

function formatLongDate(iso: string): string {
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

export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const ctx = await initBrandedDoc();
  const { doc } = ctx;

  drawHeaderBand(ctx, "Invoice");

  // Title block: number + status pill side-by-side, issued/travel meta below.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(invoice.invoiceNumber, PAGE.MARGIN_L, ctx.y);

  // Status pill, right-aligned on the same line.
  const status = statusPill(invoice.status);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const labelW = doc.getTextWidth(status.label) + 6;
  const pillX = PAGE.W - PAGE.MARGIN_R - labelW;
  const pillY = ctx.y - 5;
  doc.setFillColor(...rgb(status.fill));
  doc.roundedRect(pillX, pillY, labelW, 6, 1.5, 1.5, "F");
  doc.setTextColor(...rgb(status.text));
  doc.text(status.label, pillX + labelW / 2, pillY + 4, { align: "center" });
  ctx.y += 7;

  // Issued + travel + reference, in muted ink.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  const metaBits: string[] = [`Issued ${formatLongDate(invoice.createdAt)}`];
  if (invoice.travelDate) metaBits.push(`Travel ${invoice.travelDate}`);
  if (invoice.reference) metaBits.push(`Ref ${invoice.reference}`);
  doc.text(metaBits.join("   ·   "), PAGE.MARGIN_L, ctx.y);
  ctx.y += 8;

  // Two-column cards: Bill to + Booking details.
  const cardW = (CONTENT_W - 4) / 2;
  const cardH = 32;
  const cardY = ctx.y;
  doc.setDrawColor(...rgb(BRAND.border));
  doc.setFillColor(...rgb(BRAND.cream));
  doc.roundedRect(PAGE.MARGIN_L, cardY, cardW, cardH, 2, 2, "FD");
  doc.roundedRect(PAGE.MARGIN_L + cardW + 4, cardY, cardW, cardH, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text("BILL TO", PAGE.MARGIN_L + 4, cardY + 5);
  doc.text("BOOKING DETAILS", PAGE.MARGIN_L + cardW + 8, cardY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.ink));
  let leftY = cardY + 11;
  doc.setFont("helvetica", "bold");
  doc.text(invoice.clientName || "Guest", PAGE.MARGIN_L + 4, leftY);
  leftY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail, PAGE.MARGIN_L + 4, leftY);
    leftY += 4.5;
  }
  if (invoice.clientPhone) {
    doc.text(invoice.clientPhone, PAGE.MARGIN_L + 4, leftY);
  }

  let rightY = cardY + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.ink));
  const wrappedPkg = doc.splitTextToSize(
    invoice.packageName || "Tour package",
    cardW - 8
  );
  doc.text(wrappedPkg, PAGE.MARGIN_L + cardW + 8, rightY);
  rightY += wrappedPkg.length * 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  if (invoice.travelDate) {
    doc.text(`Travel: ${invoice.travelDate}`, PAGE.MARGIN_L + cardW + 8, rightY);
    rightY += 4.5;
  }
  if (invoice.pax != null) {
    doc.text(
      `${invoice.pax} ${invoice.pax === 1 ? "traveller" : "travellers"}`,
      PAGE.MARGIN_L + cardW + 8,
      rightY
    );
  }

  ctx.y = cardY + cardH + 9;

  // Line items table — header.
  const COL_DESC = PAGE.MARGIN_L;
  const COL_AMOUNT = PAGE.W - PAGE.MARGIN_R;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text("DESCRIPTION", COL_DESC, ctx.y);
  doc.text("AMOUNT", COL_AMOUNT, ctx.y, { align: "right" });
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

  const rows: Array<{ label: string; amount: number }> = [
    { label: "Base package", amount: invoice.baseAmount },
    ...invoice.lineItems.map((li) => ({
      label: li.description,
      amount: li.amount,
    })),
  ];

  rows.forEach((row, idx) => {
    ensureSpace(ctx, 8);
    // Zebra row fill for readability.
    if (idx % 2 === 0) {
      doc.setFillColor(...rgb(BRAND.cream));
      doc.rect(
        PAGE.MARGIN_L - 2,
        ctx.y - 4,
        CONTENT_W + 4,
        7,
        "F"
      );
    }
    const wrapped = doc.splitTextToSize(row.label, CONTENT_W - 38);
    doc.text(wrapped, COL_DESC, ctx.y);
    doc.text(
      `${row.amount.toLocaleString()} ${invoice.currency}`,
      COL_AMOUNT,
      ctx.y,
      { align: "right" }
    );
    ctx.y += Math.max(7, wrapped.length * 4.5 + 2);
  });

  ctx.y += 4;

  // Total band — gold-tinted to draw the eye.
  ensureSpace(ctx, 16);
  doc.setFillColor(...rgb(BRAND.goldSoft));
  doc.roundedRect(PAGE.MARGIN_L - 2, ctx.y - 5, CONTENT_W + 4, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text("Total due", PAGE.MARGIN_L + 2, ctx.y + 3);
  doc.setFontSize(15);
  doc.setTextColor(...rgb(BRAND.teal));
  doc.text(
    `${invoice.totalAmount.toLocaleString()} ${invoice.currency}`,
    COL_AMOUNT - 2,
    ctx.y + 4,
    { align: "right" }
  );
  ctx.y += 18;

  // Payment terms + notes.
  ensureSpace(ctx, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text("Payment terms", PAGE.MARGIN_L, ctx.y);
  ctx.y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...rgb(BRAND.inkSoft));
  doc.text(
    "Payment due within 14 days of issue. Bank transfer details on request.",
    PAGE.MARGIN_L,
    ctx.y
  );
  ctx.y += 6;

  if (invoice.notes && invoice.notes.trim()) {
    ensureSpace(ctx, 10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb(BRAND.ink));
    doc.text("Notes", PAGE.MARGIN_L, ctx.y);
    ctx.y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...rgb(BRAND.inkSoft));
    const wrapped = doc.splitTextToSize(invoice.notes.trim(), CONTENT_W);
    doc.text(wrapped, PAGE.MARGIN_L, ctx.y);
    ctx.y += wrapped.length * 4.5;
  }

  // Closing thank-you line.
  ensureSpace(ctx, 12);
  ctx.y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text(
    "Thank you for choosing us — we're excited to host your journey.",
    PAGE.W / 2,
    ctx.y,
    { align: "center" }
  );

  finalizeBrandedDoc(ctx);
  return brandedDocToBuffer(ctx);
}
