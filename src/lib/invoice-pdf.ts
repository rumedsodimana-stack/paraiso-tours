/**
 * Generate a simple PDF invoice for email attachment.
 */

import { getAppSettings, getDisplayCompanyName } from "./app-config";
import type { Invoice } from "./types";

export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
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
  let y = 18;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(letterhead.companyName, 20, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(letterhead.tagline, 20, y);
  y += 6;
  doc.text(
    [letterhead.address, letterhead.phone, letterhead.email]
      .filter(Boolean)
      .join(" | "),
    20,
    y
  );
  y += 15;

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text("INVOICE", 20, y);
  y += 5;

  doc.setTextColor(24, 24, 27);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.invoiceNumber, 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const issuedDate = new Date(invoice.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.text(`Issued: ${issuedDate}`, 20, y);
  doc.text(`Status: ${invoice.status.replace(/_/g, " ")}`, 140, y, {
    align: "left",
  } as { align: "left" });
  y += 14;

  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, y - 2, 82, 30, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.text("Bill to", 24, y + 4);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(invoice.clientName, 24, y + 4);
  doc.text(invoice.clientEmail, 24, y + 9);
  if (invoice.clientPhone) doc.text(invoice.clientPhone, 24, y + 14);

  doc.roundedRect(108, y - 2, 82, 30, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.text("Booking details", 112, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.packageName, 112, y + 9);
  if (invoice.travelDate) doc.text(`Travel date: ${invoice.travelDate}`, 112, y + 14);
  if (invoice.pax != null) doc.text(`Travellers: ${invoice.pax}`, 112, y + 19);
  y += 36;

  const col1 = 24;
  const col2 = 185;
  doc.setDrawColor(226, 232, 240);
  doc.setFont("helvetica", "bold");
  doc.text("Description", col1, y + 2);
  doc.text("Amount", col2, y + 2, { align: "right" } as { align: "right" });
  doc.line(20, y + 4, 190, y + 4);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text("Base package", col1, y);
  doc.text(`${invoice.baseAmount.toLocaleString()} ${invoice.currency}`, col2, y, { align: "right" } as { align: "right" });
  y += 7;

  for (const item of invoice.lineItems) {
    doc.text(item.description, col1, y);
    doc.text(`${item.amount.toLocaleString()} ${invoice.currency}`, col2, y, { align: "right" } as { align: "right" });
    doc.setDrawColor(241, 245, 249);
    doc.line(20, y + 2, 190, y + 2);
    doc.setDrawColor(226, 232, 240);
    y += 6;
  }

  y += 5;
  doc.line(20, y - 2, 190, y - 2);
  doc.setFont("helvetica", "bold");
  doc.text("Total", col1, y);
  doc.text(`${invoice.totalAmount.toLocaleString()} ${invoice.currency}`, col2, y, { align: "right" } as { align: "right" });
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Payment terms: Payment due within 14 days of invoice date.", 20, y);
  y += 6;
  if (invoice.notes) {
    const wrapped = doc.splitTextToSize(`Notes: ${invoice.notes}`, 170);
    doc.text(wrapped, 20, y);
  }

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
