/**
 * Generate a branded payment voucher PDF for an outgoing payment to a
 * supplier. Used as a printable record / proof of remittance — admin
 * can download from the payment detail page or hand to the supplier.
 *
 * Same brand kit as invoice/itinerary/quotation PDFs via
 * lib/pdf-letterhead.ts.
 *
 * Layout:
 *   1. Coloured navy header band with PAYMENT VOUCHER kicker
 *   2. Voucher number (payment.reference or payment.id) + status pill
 *   3. Two cards: "Paid to" (supplier + bank details) + "Payment
 *      details" (amount, date, currency, type)
 *   4. Description + linked tour / week range narrative
 *   5. Big gold-tinted Amount band — instantly readable as the total
 *   6. Authorisation footer with company name + "Issued by" line
 *      ready for signature
 *   7. Italic gold thank-you line
 *   8. Page footer (drawn via finalizeBrandedDoc)
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
import type { HotelSupplier, Payment } from "./types";

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
  return [c.r, c.g, c.b];
}

function statusPill(status: Payment["status"]): {
  label: string;
  fill: { r: number; g: number; b: number };
  text: { r: number; g: number; b: number };
} {
  switch (status) {
    case "completed":
      return {
        label: "PAID",
        fill: { r: 220, g: 252, b: 231 },
        text: { r: 4, g: 120, b: 87 },
      };
    case "cancelled":
      return {
        label: "CANCELLED",
        fill: { r: 243, g: 244, b: 246 },
        text: { r: 75, g: 85, b: 99 },
      };
    case "pending":
    default:
      return {
        label: "PENDING",
        fill: { r: 254, g: 243, b: 199 },
        text: { r: 146, g: 64, b: 14 },
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

interface VoucherInput {
  payment: Payment;
  supplier?: HotelSupplier | null;
}

export async function generatePaymentVoucherPdf(
  input: VoucherInput
): Promise<Buffer> {
  const { payment, supplier } = input;
  const ctx = await initBrandedDoc();
  const { doc } = ctx;

  drawHeaderBand(ctx, "Payment Voucher");

  // Voucher number — the payment reference if set, else payment id.
  const voucherNumber = payment.reference || payment.id;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(voucherNumber, PAGE.MARGIN_L, ctx.y);

  const status = statusPill(payment.status);
  doc.setFontSize(8);
  const labelW = doc.getTextWidth(status.label) + 6;
  const pillX = PAGE.W - PAGE.MARGIN_R - labelW;
  const pillY = ctx.y - 5;
  doc.setFillColor(...rgb(status.fill));
  doc.roundedRect(pillX, pillY, labelW, 6, 1.5, 1.5, "F");
  doc.setTextColor(...rgb(status.text));
  doc.text(status.label, pillX + labelW / 2, pillY + 4, { align: "center" });
  ctx.y += 7;

  // Meta line: payment date + creation date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  const metaBits: string[] = [`Payment date ${formatLongDate(payment.date)}`];
  if (payment.confirmationId)
    metaBits.push(`Tour ${payment.confirmationId}`);
  if (payment.payableWeekStart && payment.payableWeekEnd) {
    metaBits.push(
      `Week ${payment.payableWeekStart} → ${payment.payableWeekEnd}`
    );
  }
  doc.text(metaBits.join("   ·   "), PAGE.MARGIN_L, ctx.y);
  ctx.y += 8;

  // Two cards: Paid to + Payment details
  const cardW = (CONTENT_W - 4) / 2;
  const cardH = 44;
  const cardY = ctx.y;
  doc.setDrawColor(...rgb(BRAND.border));
  doc.setFillColor(...rgb(BRAND.cream));
  doc.roundedRect(PAGE.MARGIN_L, cardY, cardW, cardH, 2, 2, "FD");
  doc.roundedRect(PAGE.MARGIN_L + cardW + 4, cardY, cardW, cardH, 2, 2, "FD");

  // Card labels
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text("PAID TO", PAGE.MARGIN_L + 4, cardY + 5);
  doc.text("PAYMENT DETAILS", PAGE.MARGIN_L + cardW + 8, cardY + 5);

  // Left card: supplier + bank
  let leftY = cardY + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(BRAND.ink));
  const supplierName =
    payment.supplierName || supplier?.name || "Supplier";
  doc.text(supplierName, PAGE.MARGIN_L + 4, leftY);
  leftY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  if (supplier?.bankName) {
    doc.text(supplier.bankName, PAGE.MARGIN_L + 4, leftY);
    leftY += 4;
  }
  if (supplier?.bankBranch) {
    doc.text(supplier.bankBranch, PAGE.MARGIN_L + 4, leftY);
    leftY += 4;
  }
  if (supplier?.accountName) {
    doc.text(`A/C ${supplier.accountName}`, PAGE.MARGIN_L + 4, leftY);
    leftY += 4;
  }
  if (supplier?.accountNumber) {
    doc.text(`No. ${supplier.accountNumber}`, PAGE.MARGIN_L + 4, leftY);
    leftY += 4;
  }
  if (supplier?.swiftCode) {
    doc.text(`SWIFT ${supplier.swiftCode}`, PAGE.MARGIN_L + 4, leftY);
  }

  // Right card: amount, currency, type, status
  let rightY = cardY + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(BRAND.inkMuted));
  doc.text("AMOUNT", PAGE.MARGIN_L + cardW + 8, rightY);
  rightY += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...rgb(BRAND.teal));
  doc.text(
    `${payment.amount.toLocaleString()} ${payment.currency}`,
    PAGE.MARGIN_L + cardW + 8,
    rightY
  );
  rightY += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(BRAND.inkMuted));
  doc.text("PAYMENT DATE", PAGE.MARGIN_L + cardW + 8, rightY);
  rightY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(formatLongDate(payment.date), PAGE.MARGIN_L + cardW + 8, rightY);
  rightY += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(BRAND.inkMuted));
  doc.text("PAYMENT TYPE", PAGE.MARGIN_L + cardW + 8, rightY);
  rightY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(
    payment.type === "outgoing" ? "Outgoing — supplier" : "Incoming",
    PAGE.MARGIN_L + cardW + 8,
    rightY
  );

  ctx.y = cardY + cardH + 9;

  // Description
  if (payment.description) {
    ensureSpace(ctx, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(BRAND.gold));
    doc.text("DESCRIPTION", PAGE.MARGIN_L, ctx.y);
    ctx.y += 1.5;
    doc.setDrawColor(...rgb(BRAND.gold));
    doc.setLineWidth(0.5);
    doc.line(PAGE.MARGIN_L, ctx.y, PAGE.MARGIN_L + 18, ctx.y);
    doc.setLineWidth(0.2);
    doc.setDrawColor(...rgb(BRAND.border));
    ctx.y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...rgb(BRAND.ink));
    const wrapped = doc.splitTextToSize(payment.description, CONTENT_W);
    doc.text(wrapped, PAGE.MARGIN_L, ctx.y);
    ctx.y += wrapped.length * 4.5 + 4;
  }

  // Big gold-tinted amount band — same emphasis pattern as invoice
  // total / quotation total. Helps a finance officer skim the doc
  // and see the headline number at a glance.
  ensureSpace(ctx, 18);
  doc.setFillColor(...rgb(BRAND.goldSoft));
  doc.roundedRect(PAGE.MARGIN_L - 2, ctx.y - 5, CONTENT_W + 4, 16, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text("Amount remitted", PAGE.MARGIN_L + 2, ctx.y + 3);
  doc.setFontSize(17);
  doc.setTextColor(...rgb(BRAND.teal));
  doc.text(
    `${payment.amount.toLocaleString()} ${payment.currency}`,
    PAGE.W - PAGE.MARGIN_R - 2,
    ctx.y + 5,
    { align: "right" }
  );
  ctx.y += 21;

  // Authorisation footer — signature + stamp lines for hardcopy use.
  ensureSpace(ctx, 26);
  ctx.y += 8;
  doc.setDrawColor(...rgb(BRAND.border));
  doc.setLineWidth(0.4);
  const colW = (CONTENT_W - 12) / 2;
  // Line 1: Issued by
  doc.line(PAGE.MARGIN_L, ctx.y, PAGE.MARGIN_L + colW, ctx.y);
  doc.line(
    PAGE.MARGIN_L + colW + 12,
    ctx.y,
    PAGE.MARGIN_L + colW + 12 + colW,
    ctx.y
  );
  ctx.y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  doc.text("Issued by", PAGE.MARGIN_L, ctx.y);
  doc.text(
    "Received by (supplier signature)",
    PAGE.MARGIN_L + colW + 12,
    ctx.y
  );
  ctx.y += 8;

  // Italic gold closing
  ensureSpace(ctx, 12);
  ctx.y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(BRAND.gold));
  doc.text(
    "Thank you for your continued partnership.",
    PAGE.W / 2,
    ctx.y,
    { align: "center" }
  );

  finalizeBrandedDoc(ctx);
  return brandedDocToBuffer(ctx);
}
