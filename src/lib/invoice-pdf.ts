/**
 * Generate a simple PDF invoice for email attachment.
 */

import type { Invoice } from "./types";

const LETTERHEAD = {
  companyName: "Paraíso Ceylon Tours",
  tagline: "Crafted journeys across Sri Lanka",
  address: "Colombo, Sri Lanka",
  phone: "+94 11 234 5678",
  email: "hello@paraisoceylontours.com",
};

export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  let y = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(LETTERHEAD.companyName, 20, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(LETTERHEAD.tagline, 20, y);
  y += 6;
  doc.text(`${LETTERHEAD.address} | ${LETTERHEAD.phone} | ${LETTERHEAD.email}`, 20, y);
  y += 15;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #${invoice.invoiceNumber}`, 20, y);
  doc.text(
    `Date: ${new Date(invoice.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    20,
    y + 6
  );
  y += 15;

  doc.setFont("helvetica", "bold");
  doc.text("Bill to", 20, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(invoice.clientName, 20, y);
  doc.text(invoice.clientEmail, 20, y + 5);
  if (invoice.clientPhone) doc.text(invoice.clientPhone, 20, y + 10);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.text("Booking details", 20, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(invoice.packageName, 20, y);
  if (invoice.travelDate) doc.text(`Travel date: ${invoice.travelDate}`, 20, y + 5);
  if (invoice.pax != null) doc.text(`Pax: ${invoice.pax}`, 20, y + 10);
  y += 18;

  const col1 = 20;
  const col2 = 150;
  doc.setFont("helvetica", "bold");
  doc.text("Description", col1, y);
  doc.text("Amount", col2, y, { align: "right" } as { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text("Base package", col1, y);
  doc.text(`${invoice.baseAmount.toLocaleString()} ${invoice.currency}`, col2, y, { align: "right" } as { align: "right" });
  y += 7;

  for (const item of invoice.lineItems) {
    doc.text(item.description, col1, y);
    doc.text(`${item.amount.toLocaleString()} ${invoice.currency}`, col2, y, { align: "right" } as { align: "right" });
    y += 6;
  }

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Total", col1, y);
  doc.text(`${invoice.totalAmount.toLocaleString()} ${invoice.currency}`, col2, y, { align: "right" } as { align: "right" });
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Payment terms: Payment due within 14 days of invoice date.", 20, y);

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
