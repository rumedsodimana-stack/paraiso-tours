/**
 * Email sending via Resend.
 * Setup: https://resend.com - create API key, set RESEND_API_KEY env var.
 * For testing, Resend allows sending from onboarding@resend.dev without domain verification.
 */

import { Resend } from "resend";
import type { Invoice } from "./types";

const resend = process.env.RESEND_API_KEY?.trim()
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  "Paraíso Ceylon Tours <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return resend !== null;
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
  );
}

export interface TourConfirmationParams {
  clientName: string;
  clientEmail: string;
  packageName: string;
  startDate: string;
  endDate: string;
  pax: number;
  reference?: string;
}

/**
 * Send tour confirmation email to the client when a tour is scheduled.
 */
export async function sendTourConfirmationEmail(
  params: TourConfirmationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { clientName, clientEmail, packageName, startDate, endDate, pax, reference } = params;
  const email = clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };

  const startFmt = new Date(startDate).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const endFmt = new Date(endDate).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bookingLink = reference
    ? `${getBaseUrl()}/booking/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`
    : null;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Your tour has been scheduled</h2>
  <p>Hello ${escapeHtml(clientName)},</p>
  <p>We're excited to confirm your tour with Paraíso Ceylon Tours.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Package</td><td style="padding: 12px 16px;">${escapeHtml(packageName)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Start date</td><td style="padding: 12px 16px;">${startFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">End date</td><td style="padding: 12px 16px;">${endFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Travelers</td><td style="padding: 12px 16px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
    ${reference ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Reference</td><td style="padding: 12px 16px; font-mono: monospace;">${escapeHtml(reference)}</td></tr>` : ""}
  </table>
  ${bookingLink ? `<p><a href="${bookingLink}" style="color: #0d9488; font-weight: 600;">View your booking online</a></p>` : ""}
  <p>Questions? Reply to this email or contact us at hello@paraisoceylontours.com</p>
  <p style="margin-top: 32px; color: #64748b; font-size: 14px;">— Paraíso Ceylon Tours<br>Crafted journeys across Sri Lanka</p>
</body>
</html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Tour confirmed: ${packageName} – Paraíso Ceylon Tours`,
      html,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send tour confirmation to client with invoice PDF attached.
 */
export async function sendTourConfirmationWithInvoice(
  params: TourConfirmationParams & { invoice?: Invoice }
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { clientName, clientEmail, packageName, startDate, endDate, pax, reference, invoice } = params;
  const email = clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };

  const startFmt = new Date(startDate).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const endFmt = new Date(endDate).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const bookingLink = reference
    ? `${getBaseUrl()}/booking/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`
    : null;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Your tour has been scheduled</h2>
  <p>Hello ${escapeHtml(clientName)},</p>
  <p>We're excited to confirm your tour with Paraíso Ceylon Tours.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Package</td><td style="padding: 12px 16px;">${escapeHtml(packageName)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Start date</td><td style="padding: 12px 16px;">${startFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">End date</td><td style="padding: 12px 16px;">${endFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Travelers</td><td style="padding: 12px 16px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
    ${reference ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Reference</td><td style="padding: 12px 16px; font-mono: monospace;">${escapeHtml(reference)}</td></tr>` : ""}
  </table>
  ${invoice ? `<p>Please find your invoice attached.</p>` : ""}
  ${bookingLink ? `<p><a href="${bookingLink}" style="color: #0d9488; font-weight: 600;">View your booking online</a></p>` : ""}
  <p>Questions? Reply to this email or contact us at hello@paraisoceylontours.com</p>
  <p style="margin-top: 32px; color: #64748b; font-size: 14px;">— Paraíso Ceylon Tours<br>Crafted journeys across Sri Lanka</p>
</body>
</html>
  `.trim();

  const attachments: { filename: string; content: Buffer }[] = [];
  if (invoice) {
    const { generateInvoicePdf } = await import("./invoice-pdf");
    const pdfBuffer = await generateInvoicePdf(invoice);
    attachments.push({
      filename: `Invoice-${invoice.invoiceNumber}.pdf`,
      content: pdfBuffer,
    });
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Tour confirmed: ${packageName} – Paraíso Ceylon Tours`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export interface SupplierReservationParams {
  supplierEmail: string;
  supplierName: string;
  clientName: string;
  reference: string;
  packageName: string;
  travelDate?: string;
  pax: number;
  duration?: string;
}

/**
 * Send reservation request email to a supplier.
 */
export async function sendSupplierReservationEmail(
  params: SupplierReservationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { supplierEmail, supplierName, clientName, reference, packageName, travelDate, pax, duration } = params;
  const email = supplierEmail?.trim();
  if (!email) return { ok: false, error: "No supplier email" };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Reservation Request</h2>
  <p>Dear ${escapeHtml(supplierName)},</p>
  <p>We would like to request a reservation for the following booking:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Booking reference</td><td style="padding: 12px 16px; font-mono;">${escapeHtml(reference)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Client</td><td style="padding: 12px 16px;">${escapeHtml(clientName)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Package</td><td style="padding: 12px 16px;">${escapeHtml(packageName)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Travel dates</td><td style="padding: 12px 16px;">${travelDate ?? "TBD"}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Pax</td><td style="padding: 12px 16px;">${pax}</td></tr>
    ${duration ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Duration</td><td style="padding: 12px 16px;">${escapeHtml(duration)}</td></tr>` : ""}
  </table>
  <p>Please confirm availability and send us your best rate.</p>
  <p>Thank you,</p>
  <p><strong>Paraíso Ceylon Tours</strong><br>Crafted journeys across Sri Lanka</p>
</body>
</html>
  `.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Reservation request – ${reference} – ${clientName}`,
      html,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export interface PaymentReceiptParams {
  clientEmail: string;
  clientName: string;
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  date?: string;
}

/**
 * Send payment received / paid receipt email to the client.
 */
export async function sendPaymentReceiptEmail(
  params: PaymentReceiptParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { clientEmail, clientName, amount, currency, description, reference, date } = params;
  const email = clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };

  const dateFmt = date ? new Date(date).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Payment received – thank you</h2>
  <p>Hello ${escapeHtml(clientName)},</p>
  <p>We have received your payment for the following:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Description</td><td style="padding: 12px 16px;">${escapeHtml(description)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Amount paid</td><td style="padding: 12px 16px; font-weight: 600; color: #059669;">${amount.toLocaleString()} ${currency}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Date</td><td style="padding: 12px 16px;">${dateFmt}</td></tr>
    ${reference ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Reference</td><td style="padding: 12px 16px; font-mono: monospace;">${escapeHtml(reference)}</td></tr>` : ""}
  </table>
  <p>Your journey is now marked as completed and paid. We look forward to welcoming you.</p>
  <p>Questions? Reply to this email or contact us at hello@paraisoceylontours.com</p>
  <p style="margin-top: 32px; color: #64748b; font-size: 14px;">— Paraíso Ceylon Tours<br>Crafted journeys across Sri Lanka</p>
</body>
</html>
  `.trim();

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Payment received – ${description} – Paraíso Ceylon Tours`,
      html,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

