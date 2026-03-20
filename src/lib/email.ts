/**
 * Email sending via Resend.
 * Setup: https://resend.com - create API key, set RESEND_API_KEY env var.
 * For testing, Resend allows sending from onboarding@resend.dev without domain verification.
 */

import { Resend } from "resend";
import { getAppSettings, getDisplayCompanyName } from "./app-config";
import type { Invoice } from "./types";

const resend = process.env.RESEND_API_KEY?.trim()
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function isEmailConfigured(): boolean {
  return resend !== null;
}

/**
 * Retry an async email send with exponential backoff.
 * Retries up to maxAttempts times on transient failures (5xx or network errors).
 * Rate-limit (429) and client errors (4xx) are not retried.
 */
async function withEmailRetry<T>(
  fn: () => Promise<{
    data: T | null;
    error: { statusCode?: number | null; message: string } | null;
  }>,
  maxAttempts = 3
): Promise<{ data: T | null; error: string | null }> {
  let lastError = "Unknown error";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn();
    if (!result.error) {
      return { data: result.data, error: null };
    }
    const status = result.error.statusCode ?? 0;
    // Do not retry client errors (4xx) — they won't change
    if (status >= 400 && status < 500) {
      return { data: null, error: result.error.message };
    }
    lastError = result.error.message;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
  return { data: null, error: lastError };
}

async function getEmailBranding() {
  const settings = await getAppSettings();
  return {
    companyName: getDisplayCompanyName(settings),
    tagline: settings.company.tagline || "",
    email: settings.company.email || "hello@paraisoceylontours.com",
  };
}

function getFromEmail(companyName: string) {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `${companyName} <onboarding@resend.dev>`
  );
}

function getQuestionsLine(branding: Awaited<ReturnType<typeof getEmailBranding>>) {
  return `Questions? Reply to this email or contact us at ${branding.email}`;
}

function getSignatureHtml(
  branding: Awaited<ReturnType<typeof getEmailBranding>>
) {
  return `<p style="margin-top: 32px; color: #64748b; font-size: 14px;">— ${escapeHtml(
    branding.companyName
  )}<br>${escapeHtml(branding.tagline || branding.companyName)}</p>`;
}

function getBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
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
  const branding = await getEmailBranding();

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
  <p>We're excited to confirm your tour with ${escapeHtml(branding.companyName)}.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Package</td><td style="padding: 12px 16px;">${escapeHtml(packageName)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Start date</td><td style="padding: 12px 16px;">${startFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">End date</td><td style="padding: 12px 16px;">${endFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Travelers</td><td style="padding: 12px 16px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
    ${reference ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Reference</td><td style="padding: 12px 16px; font-mono: monospace;">${escapeHtml(reference)}</td></tr>` : ""}
  </table>
  ${bookingLink ? `<p><a href="${bookingLink}" style="color: #0d9488; font-weight: 600;">View your booking online</a></p>` : ""}
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body>
</html>
  `.trim();

  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Tour confirmed: ${packageName} – ${branding.companyName}`,
      html,
    }));

    if (error) return { ok: false, error };
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

export interface BookingRequestConfirmationParams {
  clientName: string;
  clientEmail: string;
  packageName: string;
  reference: string;
  travelDate?: string;
  pax: number;
}

/**
 * Send booking request confirmation to the guest when they submit a booking from the client portal.
 */
export async function sendBookingRequestConfirmation(
  params: BookingRequestConfirmationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { clientName, clientEmail, packageName, reference, travelDate, pax } = params;
  const email = clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };
  const branding = await getEmailBranding();

  const travelDateFmt = travelDate
    ? new Date(travelDate + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const bookingLink = `${getBaseUrl()}/my-bookings?email=${encodeURIComponent(email)}`;
  const viewByRefLink = `${getBaseUrl()}/booking/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 32px; background: #fafaf9;">
  <div style="border-left: 4px solid #0d9488; padding-left: 24px; margin-bottom: 28px;">
    <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #0d9488; font-weight: 600;">Booking received</p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">${escapeHtml(branding.companyName)}</p>
  </div>

  <p style="margin: 0 0 20px 0;">Hello ${escapeHtml(clientName)},</p>

  <p style="margin: 0 0 20px 0;">
    Thank you for your booking request. We have received it and will get back to you shortly.
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Your booking request</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b; width: 42%;">Booking reference</td><td style="padding: 12px 18px; font-family: monospace; font-weight: 600;">${escapeHtml(reference)}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Package</td><td style="padding: 12px 18px;">${escapeHtml(packageName)}</td></tr>
    ${travelDateFmt ? `<tr><td style="padding: 12px 18px; color: #64748b;">Travel date</td><td style="padding: 12px 18px;">${travelDateFmt}</td></tr>` : ""}
    <tr><td style="padding: 12px 18px; color: #64748b;">Travelers</td><td style="padding: 12px 18px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
  </table>

  <p style="margin: 0 0 20px 0;">
    <strong>What happens next?</strong><br>
    Our team will review your request and confirm availability. You will receive a confirmation email with your full itinerary and invoice once everything is set.
  </p>

  <p style="margin: 0 0 24px 0;">
    <a href="${bookingLink}" style="color: #0d9488; font-weight: 600;">View your bookings</a> &middot; <a href="${viewByRefLink}" style="color: #0d9488; font-weight: 600;">View by reference</a>
  </p>

  <p style="margin: 0 0 8px 0;">${escapeHtml(getQuestionsLine(branding))}</p>

  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px;">
    <tr><td style="font-size: 15px; font-weight: 700; color: #0d9488;">${escapeHtml(branding.companyName)}</td></tr>
    <tr><td style="font-size: 13px; color: #64748b;">${escapeHtml(branding.tagline || branding.companyName)}</td></tr>
    <tr><td style="font-size: 12px; color: #94a3b8;">${escapeHtml(branding.email)}</td></tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Booking received: ${packageName} – ${reference}`,
      html,
    }));

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
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
  const branding = await getEmailBranding();

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
  <p>We're excited to confirm your tour with ${escapeHtml(branding.companyName)}.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Package</td><td style="padding: 12px 16px;">${escapeHtml(packageName)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Start date</td><td style="padding: 12px 16px;">${startFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">End date</td><td style="padding: 12px 16px;">${endFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Travelers</td><td style="padding: 12px 16px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
    ${reference ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Reference</td><td style="padding: 12px 16px; font-mono: monospace;">${escapeHtml(reference)}</td></tr>` : ""}
  </table>
  ${invoice ? `<p>Please find your invoice attached.</p>` : ""}
  ${bookingLink ? `<p><a href="${bookingLink}" style="color: #0d9488; font-weight: 600;">View your booking online</a></p>` : ""}
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
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
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Tour confirmed: ${packageName} – ${branding.companyName}`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    }));

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export interface SupplierReservationParams {
  supplierEmail: string;
  supplierName: string;
  supplierType: "Accommodation" | "Transport" | "Meals";
  clientName: string;
  /** Additional guest names (e.g. accompanied travelers) */
  accompaniedGuestName?: string;
  reference: string;
  packageName: string;
  optionLabel: string;
  /** Check-in or service start date (YYYY-MM-DD) */
  checkInDate: string;
  /** Check-out or service end date (YYYY-MM-DD) */
  checkOutDate: string;
  pax: number;
  duration?: string;
}

function formatDateLong(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Build professional reservation email body by supplier type.
 */
function buildSupplierReservationHtml(
  params: SupplierReservationParams,
  branding: Awaited<ReturnType<typeof getEmailBranding>>
): string {
  const {
    supplierName,
    supplierType,
    clientName,
    accompaniedGuestName,
    reference,
    packageName,
    optionLabel,
    checkInDate,
    checkOutDate,
    pax,
  } = params;

  const guestNames =
    accompaniedGuestName?.trim()
      ? `${escapeHtml(clientName)} and ${escapeHtml(accompaniedGuestName.trim())}`
      : escapeHtml(clientName);
  const checkInFmt = formatDateLong(checkInDate);
  const checkOutFmt = formatDateLong(checkOutDate);

  const signature = `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px;">
  <tr>
    <td style="font-size: 15px; font-weight: 700; color: #0d9488;">${escapeHtml(branding.companyName)}</td>
  </tr>
  <tr><td style="height: 4px;"></td></tr>
  <tr>
    <td style="font-size: 13px; color: #64748b;">${escapeHtml(branding.tagline || branding.companyName)}</td>
  </tr>
  <tr><td style="height: 8px;"></td></tr>
  <tr>
    <td style="font-size: 12px; color: #94a3b8;">${escapeHtml(branding.email)}</td>
  </tr>
</table>
  `.trim();

  if (supplierType === "Accommodation") {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 32px; background: #fafaf9;">
  <div style="border-left: 4px solid #0d9488; padding-left: 24px; margin-bottom: 28px;">
    <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #0d9488; font-weight: 600;">Reservation Request</p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">${escapeHtml(branding.companyName)}</p>
  </div>

  <p style="margin: 0 0 20px 0;">Dear ${escapeHtml(supplierName)},</p>

  <p style="margin: 0 0 20px 0;">
    We would like to request a room reservation for our guest. Please find the details below:
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Guest &amp; booking</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b; width: 42%;">Guest name(s)</td><td style="padding: 12px 18px; font-weight: 500;">${guestNames}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Number of guests</td><td style="padding: 12px 18px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Booking reference</td><td style="padding: 12px 18px; font-family: monospace; font-weight: 600;">${escapeHtml(reference)}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Package</td><td style="padding: 12px 18px;">${escapeHtml(packageName)}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Stay dates</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Check-in</td><td style="padding: 12px 18px; font-weight: 500;">${checkInFmt}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Check-out</td><td style="padding: 12px 18px; font-weight: 500;">${checkOutFmt}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Accommodation</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Room / type</td><td style="padding: 12px 18px;">${escapeHtml(optionLabel)}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Billing</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Bill to</td><td style="padding: 12px 18px; font-weight: 600; color: #0d9488;">${escapeHtml(branding.companyName)}</td></tr>
  </table>

  <p style="margin: 0 0 24px 0;">
    Please confirm availability and send us your best rate. We look forward to your reply.
  </p>

  <p style="margin: 0 0 8px 0;">Kind regards,</p>
  ${signature}
</body>
</html>
    `.trim();
  }

  if (supplierType === "Transport") {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 32px; background: #fafaf9;">
  <div style="border-left: 4px solid #0d9488; padding-left: 24px; margin-bottom: 28px;">
    <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #0d9488; font-weight: 600;">Transport Reservation</p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">${escapeHtml(branding.companyName)}</p>
  </div>

  <p style="margin: 0 0 20px 0;">Dear ${escapeHtml(supplierName)},</p>

  <p style="margin: 0 0 20px 0;">
    We would like to book transport services for our guest. Please find the details below:
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Guest &amp; booking</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b; width: 42%;">Guest name(s)</td><td style="padding: 12px 18px; font-weight: 500;">${guestNames}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Number of passengers</td><td style="padding: 12px 18px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Booking reference</td><td style="padding: 12px 18px; font-family: monospace; font-weight: 600;">${escapeHtml(reference)}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Package</td><td style="padding: 12px 18px;">${escapeHtml(packageName)}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Service dates</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">From</td><td style="padding: 12px 18px; font-weight: 500;">${checkInFmt}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">To</td><td style="padding: 12px 18px; font-weight: 500;">${checkOutFmt}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Vehicle / service</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Type</td><td style="padding: 12px 18px;">${escapeHtml(optionLabel)}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Billing</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Bill to</td><td style="padding: 12px 18px; font-weight: 600; color: #0d9488;">${escapeHtml(branding.companyName)}</td></tr>
  </table>

  <p style="margin: 0 0 24px 0;">
    Please confirm availability and send us your quotation. We look forward to your reply.
  </p>

  <p style="margin: 0 0 8px 0;">Kind regards,</p>
  ${signature}
</body>
</html>
    `.trim();
  }

  // Meals
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 32px; background: #fafaf9;">
  <div style="border-left: 4px solid #0d9488; padding-left: 24px; margin-bottom: 28px;">
    <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #0d9488; font-weight: 600;">Meal / Catering Reservation</p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">${escapeHtml(branding.companyName)}</p>
  </div>

  <p style="margin: 0 0 20px 0;">Dear ${escapeHtml(supplierName)},</p>

  <p style="margin: 0 0 20px 0;">
    We would like to arrange meal services for our guest. Please find the details below:
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Guest &amp; booking</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b; width: 42%;">Guest name(s)</td><td style="padding: 12px 18px; font-weight: 500;">${guestNames}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Number of guests</td><td style="padding: 12px 18px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Booking reference</td><td style="padding: 12px 18px; font-family: monospace; font-weight: 600;">${escapeHtml(reference)}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Package</td><td style="padding: 12px 18px;">${escapeHtml(packageName)}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Service dates</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">From</td><td style="padding: 12px 18px; font-weight: 500;">${checkInFmt}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">To</td><td style="padding: 12px 18px; font-weight: 500;">${checkOutFmt}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Meal plan</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Type</td><td style="padding: 12px 18px;">${escapeHtml(optionLabel)}</td></tr>
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Billing</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Bill to</td><td style="padding: 12px 18px; font-weight: 600; color: #0d9488;">${escapeHtml(branding.companyName)}</td></tr>
  </table>

  <p style="margin: 0 0 24px 0;">
    Please confirm availability and send us your best rate. We look forward to your reply.
  </p>

  <p style="margin: 0 0 8px 0;">Kind regards,</p>
  ${signature}
</body>
</html>
  `.trim();
}

/**
 * Send reservation request email to a supplier.
 * Uses type-specific templates (Accommodation, Transport, Meals) with guest details,
 * check-in/check-out dates, and "Bill to: Paraíso Ceylon Tours".
 */
export async function sendSupplierReservationEmail(
  params: SupplierReservationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { supplierEmail, supplierType, clientName, reference } = params;
  const email = supplierEmail?.trim();
  if (!email) return { ok: false, error: "No supplier email" };
  const branding = await getEmailBranding();

  const html = buildSupplierReservationHtml(params, branding);

  const subject =
    supplierType === "Accommodation"
      ? `Room reservation request – ${reference} – ${escapeHtml(clientName)}`
      : supplierType === "Transport"
      ? `Transport reservation – ${reference} – ${escapeHtml(clientName)}`
      : `Meal reservation – ${reference} – ${escapeHtml(clientName)}`;

  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject,
      html,
    }));

    if (error) return { ok: false, error };
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
  const branding = await getEmailBranding();

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
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body>
</html>
  `.trim();

  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Payment received – ${description} – ${branding.companyName}`,
      html,
    }));

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
