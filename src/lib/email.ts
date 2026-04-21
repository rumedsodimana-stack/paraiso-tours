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

export interface BookingStatusChangeParams {
  clientName: string;
  clientEmail: string;
  packageName: string;
  reference: string;
  status: "hold" | "cancelled";
  notes?: string;
}

/**
 * Send guest notification when booking status changes to hold or cancelled.
 */
export async function sendBookingStatusChangeEmail(
  params: BookingStatusChangeParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { clientName, clientEmail, packageName, reference, status, notes } = params;
  const email = clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };
  const branding = await getEmailBranding();

  const bookingLink = `${getBaseUrl()}/booking/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`;

  const isHold = status === "hold";
  const titleColor = isHold ? "#c9922f" : "#7c3a24";
  const statusLabel = isHold ? "On Hold" : "Cancelled";
  const headingText = isHold
    ? "Your booking has been placed on hold"
    : "Your booking has been cancelled";
  const bodyText = isHold
    ? "Your booking is temporarily on hold while we confirm availability. Our team will be in touch shortly."
    : "Unfortunately, your booking has been cancelled. Please contact us if you have any questions or would like to make a new booking.";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 32px; background: #fafaf9;">
  <div style="border-left: 4px solid ${titleColor}; padding-left: 24px; margin-bottom: 28px;">
    <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: ${titleColor}; font-weight: 600;">Booking update</p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">${escapeHtml(branding.companyName)}</p>
  </div>

  <p style="margin: 0 0 20px 0;">Hello ${escapeHtml(clientName)},</p>

  <p style="margin: 0 0 20px 0;">${bodyText}</p>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Booking details</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b; width: 42%;">Reference</td><td style="padding: 12px 18px; font-family: monospace; font-weight: 600;">${escapeHtml(reference)}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Package</td><td style="padding: 12px 18px;">${escapeHtml(packageName)}</td></tr>
    <tr><td style="padding: 12px 18px; color: #64748b;">Status</td><td style="padding: 12px 18px; font-weight: 600; color: ${titleColor};">${statusLabel}</td></tr>
    ${notes ? `<tr><td style="padding: 12px 18px; color: #64748b;">Note</td><td style="padding: 12px 18px;">${escapeHtml(notes)}</td></tr>` : ""}
  </table>

  <p style="margin: 0 0 24px 0;">
    <a href="${bookingLink}" style="color: #0d9488; font-weight: 600;">View your booking online</a>
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
    const { error } = await withEmailRetry(() => resend!.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `${headingText} – ${escapeHtml(reference)}`,
      html,
    }));

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export interface QuotationEmailParams {
  contactName: string;
  contactEmail: string;
  companyName?: string;
  title?: string;
  reference: string;
  destination?: string;
  travelDate?: string;
  duration?: string;
  pax: number;
  lineItems: { label: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discountAmount?: number;
  totalAmount: number;
  currency: string;
  inclusions?: string[];
  exclusions?: string[];
  termsAndConditions?: string;
  validUntil?: string;
  itinerary?: { day: number; title: string; description: string; accommodation?: string }[];
  quotationId: string;
}

/**
 * Send a quotation to the client with full itinerary, pricing, and a link to view online.
 */
export async function sendQuotationEmail(
  params: QuotationEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const {
    contactName, contactEmail, companyName, title, reference, destination,
    travelDate, duration, pax, lineItems, subtotal, discountAmount, totalAmount,
    currency, inclusions, exclusions, termsAndConditions, validUntil, itinerary,
    quotationId,
  } = params;

  const email = contactEmail?.trim();
  if (!email) return { ok: false, error: "No contact email" };
  const branding = await getEmailBranding();
  const viewUrl = `${getBaseUrl()}/quotation/${encodeURIComponent(quotationId)}`;

  const travelDateFmt = travelDate
    ? new Date(travelDate + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : null;

  const validUntilFmt = validUntil
    ? new Date(validUntil + "T12:00:00").toLocaleDateString("en-GB", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  const lineItemRows = lineItems.map((li) => `
    <tr>
      <td style="padding: 10px 18px; color: #334155;">${escapeHtml(li.quantity !== 1 ? `${li.label} \u00d7 ${li.quantity}` : li.label)}</td>
      <td style="padding: 10px 18px; text-align: right; color: #334155;">${li.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${escapeHtml(currency)}</td>
    </tr>`).join("");

  const itineraryRows = (itinerary ?? []).map((day) => `
    <tr>
      <td valign="top" style="padding: 10px 18px; width: 32px; font-weight: 700; color: #0d9488; white-space: nowrap;">Day ${day.day}</td>
      <td style="padding: 10px 18px;">
        <p style="margin: 0 0 4px 0; font-weight: 600; color: #0f172a;">${escapeHtml(day.title)}</p>
        ${day.description ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #64748b;">${escapeHtml(day.description)}</p>` : ""}
        ${day.accommodation ? `<p style="margin: 0; font-size: 12px; color: #94a3b8;">\uD83C\uDFE8 ${escapeHtml(day.accommodation)}</p>` : ""}
      </td>
    </tr>`).join("");

  const inclusionsList = (inclusions ?? []).map((inc) =>
    `<li style="margin-bottom: 4px; color: #334155;">${escapeHtml(inc)}</li>`
  ).join("");

  const exclusionsList = (exclusions ?? []).map((exc) =>
    `<li style="margin-bottom: 4px; color: #334155;">${escapeHtml(exc)}</li>`
  ).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1e293b; max-width: 620px; margin: 0 auto; padding: 32px; background: #fafaf9;">
  <div style="border-left: 4px solid #0d9488; padding-left: 24px; margin-bottom: 28px;">
    <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #0d9488; font-weight: 600;">Tour Quotation</p>
    <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${escapeHtml(title || (destination ? destination + " Tour" : "Custom Tour"))}</p>
    <p style="margin: 4px 0 0 0; font-size: 12px; font-family: monospace; color: #94a3b8;">${escapeHtml(reference)}</p>
  </div>
  <p style="margin: 0 0 20px 0;">Dear ${escapeHtml(contactName)}${companyName ? ` / ${escapeHtml(companyName)}` : ""},</p>
  <p style="margin: 0 0 20px 0;">Thank you for your enquiry. Please find your personalised tour quotation below.${validUntilFmt ? ` This quotation is valid until <strong>${validUntilFmt}</strong>.` : ""}</p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Trip summary</td></tr>
    ${destination ? `<tr><td style="padding: 10px 18px; color: #64748b; width: 42%;">Destination</td><td style="padding: 10px 18px; font-weight: 500;">${escapeHtml(destination)}</td></tr>` : ""}
    ${travelDateFmt ? `<tr><td style="padding: 10px 18px; color: #64748b;">Travel date</td><td style="padding: 10px 18px;">${travelDateFmt}</td></tr>` : ""}
    ${duration ? `<tr><td style="padding: 10px 18px; color: #64748b;">Duration</td><td style="padding: 10px 18px;">${escapeHtml(duration)}</td></tr>` : ""}
    <tr><td style="padding: 10px 18px; color: #64748b;">Travellers</td><td style="padding: 10px 18px;">${pax} ${pax === 1 ? "person" : "people"}</td></tr>
  </table>
  ${itinerary && itinerary.length > 0 ? `<h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Day-by-Day Itinerary</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">${itineraryRows}</table>` : ""}
  <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Pricing</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <tr><td colspan="2" style="padding: 14px 18px; background: #f1f5f9; font-weight: 600; color: #334155;">Line items</td></tr>
    ${lineItemRows}
    <tr style="border-top: 1px solid #e2e8f0;"><td style="padding: 10px 18px; color: #64748b;">Subtotal</td><td style="padding: 10px 18px; text-align: right; color: #334155;">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${escapeHtml(currency)}</td></tr>
    ${discountAmount ? `<tr><td style="padding: 10px 18px; color: #64748b;">Discount</td><td style="padding: 10px 18px; text-align: right; color: #dc2626;">\u2212${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${escapeHtml(currency)}</td></tr>` : ""}
    <tr style="border-top: 2px solid #0d9488; background: #f0fdfb;"><td style="padding: 14px 18px; font-weight: 700; color: #0f172a; font-size: 15px;">Total</td><td style="padding: 14px 18px; text-align: right; font-weight: 700; color: #0f172a; font-size: 15px;">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${escapeHtml(currency)}</td></tr>
  </table>
  ${inclusionsList || exclusionsList ? `<table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;" cellspacing="0" cellpadding="0"><tr valign="top">
    ${inclusionsList ? `<td style="width: 50%; padding-right: 10px;"><h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Included</h3><ul style="margin: 0; padding: 0 0 0 18px; font-size: 13px;">${inclusionsList}</ul></td>` : ""}
    ${exclusionsList ? `<td style="width: 50%; padding-left: 10px;"><h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Not included</h3><ul style="margin: 0; padding: 0 0 0 18px; font-size: 13px; color: #64748b;">${exclusionsList}</ul></td>` : ""}
  </tr></table>` : ""}
  ${termsAndConditions ? `<h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Terms &amp; Conditions</h3><p style="margin: 0 0 24px 0; font-size: 13px; color: #64748b; white-space: pre-line;">${escapeHtml(termsAndConditions)}</p>` : ""}
  <div style="margin: 28px 0; text-align: center;">
    <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; background: #0d9488; color: #fff; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 8px;">View Quotation Online</a>
  </div>
  <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">To accept this quotation or ask any questions, simply reply to this email.</p>
  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 32px;">
    <tr><td style="font-size: 15px; font-weight: 700; color: #0d9488;">${escapeHtml(branding.companyName)}</td></tr>
    <tr><td style="font-size: 13px; color: #64748b;">${escapeHtml(branding.tagline || branding.companyName)}</td></tr>
    <tr><td style="font-size: 12px; color: #94a3b8;">${escapeHtml(branding.email)}</td></tr>
  </table>
</body>
</html>`.trim();

  try {
    const subject = title
      ? `Your quotation: ${title} \u2014 ${reference}`
      : destination
        ? `Your ${destination} tour quotation \u2014 ${reference}`
        : `Tour quotation \u2014 ${reference} \u2014 ${branding.companyName}`;

    const { error } = await withEmailRetry(() => resend!.emails.send({
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

export interface InvoiceEmailParams {
  clientName: string;
  clientEmail: string;
  invoice: Invoice;
  note?: string;
}

/**
 * Send an invoice email to the guest with the invoice PDF attached.
 * Standalone — not tied to scheduling.
 */
export async function sendInvoiceEmail(
  params: InvoiceEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { clientName, clientEmail, invoice, note } = params;
  const email = clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };
  const branding = await getEmailBranding();

  const statusLabel = invoice.status.replace(/_/g, " ");
  const totalFmt = `${invoice.totalAmount.toLocaleString()} ${invoice.currency}`;
  const dueLine = invoice.status === "paid"
    ? `This invoice is fully paid.`
    : `Please settle ${totalFmt} at your earliest convenience.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Invoice ${escapeHtml(invoice.invoiceNumber)}</h2>
  <p>Hello ${escapeHtml(clientName)},</p>
  <p>Please find your invoice from ${escapeHtml(branding.companyName)} attached.</p>
  ${note ? `<p style="padding:12px 16px;background:#f8fafc;border-radius:8px;">${escapeHtml(note)}</p>` : ""}
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Invoice</td><td style="padding: 12px 16px;">${escapeHtml(invoice.invoiceNumber)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Status</td><td style="padding: 12px 16px; text-transform: capitalize;">${escapeHtml(statusLabel)}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Amount</td><td style="padding: 12px 16px; font-weight: 600; color: #0d9488;">${totalFmt}</td></tr>
    ${invoice.reference ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Reference</td><td style="padding: 12px 16px;">${escapeHtml(invoice.reference)}</td></tr>` : ""}
  </table>
  <p>${dueLine}</p>
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body>
</html>
  `.trim();

  const { generateInvoicePdf } = await import("./invoice-pdf");
  const pdfBuffer = await generateInvoicePdf(invoice);

  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Invoice ${invoice.invoiceNumber} – ${branding.companyName}`,
      html,
      attachments: [
        {
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    }));

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export interface ItineraryEmailParams {
  clientName: string;
  clientEmail: string;
  packageName: string;
  startDate: string;
  endDate: string;
  reference?: string;
  pdfBuffer: Buffer;
  filename: string;
}

/**
 * Send the tour itinerary PDF to the guest.
 */
export async function sendItineraryEmail(
  params: ItineraryEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  const { clientName, clientEmail, packageName, startDate, endDate, reference, pdfBuffer, filename } = params;
  const email = clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };
  const branding = await getEmailBranding();

  const startFmt = new Date(startDate).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const endFmt = new Date(endDate).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Your itinerary</h2>
  <p>Hello ${escapeHtml(clientName)},</p>
  <p>Please find your day-by-day itinerary for <b>${escapeHtml(packageName)}</b> attached as a PDF.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Start</td><td style="padding: 12px 16px;">${startFmt}</td></tr>
    <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">End</td><td style="padding: 12px 16px;">${endFmt}</td></tr>
    ${reference ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Reference</td><td style="padding: 12px 16px;">${escapeHtml(reference)}</td></tr>` : ""}
  </table>
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body>
</html>
  `.trim();

  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Itinerary: ${packageName} – ${branding.companyName}`,
      html,
      attachments: [{ filename, content: pdfBuffer }],
    }));

    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// ── Additional guest-facing templates ────────────────────────────────────

export interface PreTripReminderParams {
  clientName: string;
  clientEmail: string;
  packageName: string;
  startDate: string;
  daysUntil: number;
  reference?: string;
}

export async function sendPreTripReminderEmail(
  params: PreTripReminderParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  const email = params.clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };
  const branding = await getEmailBranding();
  const startFmt = new Date(params.startDate).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const html = `
<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Your trip starts in ${params.daysUntil} day${params.daysUntil === 1 ? "" : "s"}</h2>
  <p>Hello ${escapeHtml(params.clientName)},</p>
  <p>This is a friendly reminder that your tour with ${escapeHtml(branding.companyName)} begins on <b>${startFmt}</b>.</p>
  <p>Package: <b>${escapeHtml(params.packageName)}</b>${params.reference ? ` (ref ${escapeHtml(params.reference)})` : ""}</p>
  <p>A few things to confirm before you travel:</p>
  <ul>
    <li>Valid passport &amp; any visas required</li>
    <li>Travel insurance</li>
    <li>Comfortable clothing and appropriate footwear</li>
    <li>Any medication you need</li>
  </ul>
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body></html>`.trim();
  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Your tour starts soon – ${params.packageName}`,
      html,
    }));
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface PostTripFollowUpParams {
  clientName: string;
  clientEmail: string;
  packageName: string;
  reference?: string;
  reviewLink?: string;
}

export async function sendPostTripFollowUpEmail(
  params: PostTripFollowUpParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  const email = params.clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };
  const branding = await getEmailBranding();
  const html = `
<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Thank you for traveling with us</h2>
  <p>Hello ${escapeHtml(params.clientName)},</p>
  <p>We hope you enjoyed your trip with ${escapeHtml(branding.companyName)}. It was a pleasure to host you${params.packageName ? ` on the <b>${escapeHtml(params.packageName)}</b>` : ""}.</p>
  <p>We'd love to hear about your experience — what you enjoyed, and anything we can do better. Your feedback helps us serve future travelers.</p>
  ${params.reviewLink ? `<p><a href="${params.reviewLink}" style="display:inline-block; background:#0d9488; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">Leave a review</a></p>` : ""}
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body></html>`.trim();
  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Thank you – ${params.packageName}`,
      html,
    }));
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface BookingChangeParams {
  clientName: string;
  clientEmail: string;
  packageName: string;
  changeType: "revision" | "cancellation";
  summary: string;
  reference?: string;
}

export async function sendBookingChangeEmail(
  params: BookingChangeParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  const email = params.clientEmail?.trim();
  if (!email) return { ok: false, error: "No client email" };
  const branding = await getEmailBranding();
  const title = params.changeType === "cancellation"
    ? "Your booking has been cancelled"
    : "Your booking has been updated";
  const html = `
<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: ${params.changeType === "cancellation" ? "#b91c1c" : "#b45309"};">${title}</h2>
  <p>Hello ${escapeHtml(params.clientName)},</p>
  <p>We're writing regarding your booking for <b>${escapeHtml(params.packageName)}</b>${params.reference ? ` (ref ${escapeHtml(params.reference)})` : ""}.</p>
  <div style="background:#f8fafc; border-left:3px solid ${params.changeType === "cancellation" ? "#b91c1c" : "#b45309"}; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin:0;">${escapeHtml(params.summary)}</p>
  </div>
  <p>If you have any questions or would like to discuss next steps, please reply to this email.</p>
  <p>${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body></html>`.trim();
  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `${title} – ${params.packageName}`,
      html,
    }));
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Supplier-facing templates ─────────────────────────────────────────────

export interface SupplierRemittanceParams {
  supplierName: string;
  supplierEmail: string;
  amount: number;
  currency: string;
  reference?: string;
  date?: string;
  description?: string;
}

export async function sendSupplierRemittanceEmail(
  params: SupplierRemittanceParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  const email = params.supplierEmail?.trim();
  if (!email) return { ok: false, error: "No supplier email" };
  const branding = await getEmailBranding();
  const dateFmt = params.date
    ? new Date(params.date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const html = `
<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0d9488;">Payment remittance advice</h2>
  <p>Dear ${escapeHtml(params.supplierName)},</p>
  <p>This notice confirms a payment from ${escapeHtml(branding.companyName)}.</p>
  <table style="width:100%; border-collapse:collapse; margin:20px 0; background:#f8fafc; border-radius:8px; overflow:hidden;">
    <tr><td style="padding:12px 16px; font-weight:600; color:#475569;">Amount</td><td style="padding:12px 16px; font-weight:600; color:#059669;">${params.amount.toLocaleString()} ${params.currency}</td></tr>
    <tr><td style="padding:12px 16px; font-weight:600; color:#475569;">Payment date</td><td style="padding:12px 16px;">${dateFmt}</td></tr>
    ${params.description ? `<tr><td style="padding:12px 16px; font-weight:600; color:#475569;">Description</td><td style="padding:12px 16px;">${escapeHtml(params.description)}</td></tr>` : ""}
    ${params.reference ? `<tr><td style="padding:12px 16px; font-weight:600; color:#475569;">Reference</td><td style="padding:12px 16px;">${escapeHtml(params.reference)}</td></tr>` : ""}
  </table>
  <p>If you have any questions please reply to this email.</p>
  ${getSignatureHtml(branding)}
</body></html>`.trim();
  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `Payment remittance – ${params.amount.toLocaleString()} ${params.currency}${params.reference ? ` – ${params.reference}` : ""}`,
      html,
    }));
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface SupplierScheduleUpdateParams {
  supplierName: string;
  supplierEmail: string;
  clientName: string;
  reference: string;
  changeType: "update" | "cancellation";
  summary: string;
}

export async function sendSupplierScheduleUpdateEmail(
  params: SupplierScheduleUpdateParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  const email = params.supplierEmail?.trim();
  if (!email) return { ok: false, error: "No supplier email" };
  const branding = await getEmailBranding();
  const title = params.changeType === "cancellation"
    ? `Reservation cancelled – ${params.reference}`
    : `Reservation updated – ${params.reference}`;
  const html = `
<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: ${params.changeType === "cancellation" ? "#b91c1c" : "#b45309"};">${title}</h2>
  <p>Dear ${escapeHtml(params.supplierName)},</p>
  <p>Please note the following change to the reservation for <b>${escapeHtml(params.clientName)}</b> (ref <b>${escapeHtml(params.reference)}</b>):</p>
  <div style="background:#f8fafc; border-left:3px solid ${params.changeType === "cancellation" ? "#b91c1c" : "#b45309"}; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin:0;">${escapeHtml(params.summary)}</p>
  </div>
  <p>Please confirm receipt of this update. ${escapeHtml(getQuestionsLine(branding))}</p>
  ${getSignatureHtml(branding)}
</body></html>`.trim();
  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: title,
      html,
    }));
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Internal / admin alerts ───────────────────────────────────────────────

export interface InternalAlertParams {
  to: string;
  subject: string;
  body: string;
  severity?: "info" | "warning" | "critical";
}

export async function sendInternalAlertEmail(
  params: InternalAlertParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  const email = params.to?.trim();
  if (!email) return { ok: false, error: "No recipient" };
  const branding = await getEmailBranding();
  const accent = params.severity === "critical"
    ? "#b91c1c"
    : params.severity === "warning"
      ? "#b45309"
      : "#0d9488";
  const html = `
<!DOCTYPE html><html><body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: ${accent};">${escapeHtml(params.subject)}</h2>
  <div style="background:#f8fafc; border-left:3px solid ${accent}; padding: 12px 16px; margin: 16px 0; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(params.body)}</div>
  <p style="font-size: 12px; color: #9ca3af;">Internal notification from ${escapeHtml(branding.companyName)} admin system.</p>
</body></html>`.trim();
  try {
    const { error } = await withEmailRetry(() => resend.emails.send({
      from: getFromEmail(branding.companyName),
      to: [email],
      subject: `[${params.severity?.toUpperCase() ?? "INFO"}] ${params.subject}`,
      html,
    }));
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
