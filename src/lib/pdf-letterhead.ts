/**
 * Shared layout primitives for branded PDFs (invoices, itineraries,
 * quotations, future reports). Keeps the colour palette + spacing
 * consistent across every document the system emits to guests and
 * suppliers, and gives every page a footer with company contact +
 * page count.
 *
 * Usage:
 *   const ctx = await initBrandedDoc();
 *   drawHeaderBand(ctx, "INVOICE");
 *   ...your content...
 *   await finalizeBrandedDoc(ctx); // adds footer to every page
 *   return ctx.toBuffer();
 *
 * All numeric coords are in millimetres — jsPDF is created with
 * unit: "mm" and format: "a4".
 */

import type { jsPDF } from "jspdf";
import { getAppSettings, getDisplayCompanyName } from "./app-config";

// Paraíso brand palette — matches the admin UI tokens.
export const BRAND = {
  ink: { r: 17, g: 39, b: 43 }, // #11272b — body text
  inkSoft: { r: 94, g: 114, b: 121 }, // #5e7279 — secondary text
  inkMuted: { r: 138, g: 155, b: 161 }, // #8a9ba1 — labels
  cream: { r: 255, g: 251, b: 244 }, // #fffbf4 — page bg accents
  beige: { r: 244, g: 236, b: 221 }, // #f4ecdd — soft fills
  border: { r: 224, g: 228, b: 221 }, // #e0e4dd
  teal: { r: 18, g: 52, b: 59 }, // #12343b — primary brand
  tealSoft: { r: 26, g: 71, b: 79 }, // #1a474f — hover state
  gold: { r: 201, g: 146, b: 47 }, // #c9922f — accent
  goldSoft: { r: 246, g: 234, b: 214 }, // #f6ead6 — gold fill
  emerald: { r: 4, g: 120, b: 87 },
  rose: { r: 159, g: 18, b: 57 },
} as const;

export const PAGE = {
  W: 210,
  H: 297,
  MARGIN_L: 18,
  MARGIN_R: 18,
  MARGIN_T: 16,
  MARGIN_B: 22,
} as const;

export const CONTENT_W = PAGE.W - PAGE.MARGIN_L - PAGE.MARGIN_R;
export const PAGE_BOTTOM = PAGE.H - PAGE.MARGIN_B;

export interface BrandLetterhead {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
}

export interface BrandedDocCtx {
  doc: jsPDF;
  letterhead: BrandLetterhead;
  /** Logo data URI ready for jsPDF.addImage; empty string if none. */
  logoDataUri: string;
  /** Aspect ratio of the loaded logo (height/width); 0 if no logo. */
  logoAspect: number;
  /** Current y cursor in mm. */
  y: number;
}

/** Convert {r,g,b} to jsPDF arg list. */
function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
  return [c.r, c.g, c.b];
}

/**
 * Best-effort logo fetch. Resolves with a data URI on success, an
 * empty string if the URL is missing/invalid/un-fetchable. We never
 * throw — a broken logo URL must not break document generation.
 */
async function loadLogoDataUri(
  url: string
): Promise<{ dataUri: string; aspect: number }> {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { dataUri: "", aspect: 0 };
  }
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return { dataUri: "", aspect: 0 };
    const contentType = response.headers.get("content-type") ?? "image/png";
    // Only accept image MIME types — defends against accidentally
    // base64-ing an HTML error page.
    if (!contentType.startsWith("image/")) {
      return { dataUri: "", aspect: 0 };
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
      // Skip oversized logos (>2MB) to keep PDFs lean.
      return { dataUri: "", aspect: 0 };
    }
    // Probe PNG/JPEG dimensions cheaply so we can preserve aspect
    // ratio without a heavyweight image library.
    const aspect = inferImageAspect(buf, contentType);
    return {
      dataUri: `data:${contentType};base64,${buf.toString("base64")}`,
      aspect,
    };
  } catch {
    return { dataUri: "", aspect: 0 };
  }
}

/**
 * Read PNG IHDR or JPEG SOF segment to compute height/width without
 * a parser library. Returns 0 if the format is unfamiliar or the
 * dimensions can't be read — the caller falls back to a square.
 */
function inferImageAspect(buf: Buffer, contentType: string): number {
  try {
    if (contentType.includes("png") && buf.length >= 24) {
      // PNG IHDR: width @ offset 16 (BE u32), height @ offset 20.
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && h > 0) return h / w;
    }
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      // Walk JPEG segments looking for SOF0/SOF2.
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        const segLen = buf.readUInt16BE(i + 2);
        if (marker === 0xc0 || marker === 0xc2) {
          const h = buf.readUInt16BE(i + 5);
          const w = buf.readUInt16BE(i + 7);
          if (w > 0 && h > 0) return h / w;
          break;
        }
        i += 2 + segLen;
      }
    }
  } catch {
    // Ignore — caller falls back.
  }
  return 0;
}

/**
 * Initialise a branded jsPDF document, load the company letterhead,
 * and best-effort fetch the logo. Cursor `y` is left at the top
 * margin so the caller can immediately drawHeaderBand or content.
 */
export async function initBrandedDoc(): Promise<BrandedDocCtx> {
  const settings = await getAppSettings();
  const letterhead: BrandLetterhead = {
    companyName: getDisplayCompanyName(settings),
    tagline: settings.company.tagline || "",
    address: settings.company.address || "",
    phone: settings.company.phone || "",
    email: settings.company.email || "hello@paraiso.tours",
    logoUrl: settings.company.logoUrl || "",
  };
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "mm", compress: true });
  // Default text + line styles.
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...rgb(BRAND.ink));
  doc.setDrawColor(...rgb(BRAND.border));
  const { dataUri, aspect } = await loadLogoDataUri(letterhead.logoUrl);
  return {
    doc,
    letterhead,
    logoDataUri: dataUri,
    logoAspect: aspect,
    y: PAGE.MARGIN_T,
  };
}

/**
 * Render the colored header band at the top of the FIRST page.
 * Includes the company logo (if set), name, tagline, contact line,
 * and a "kicker" label like "INVOICE" or "TOUR ITINERARY" in gold.
 *
 * Leaves the cursor `ctx.y` positioned just below the band, ready
 * for document-specific content (title, reference, etc.).
 */
export function drawHeaderBand(ctx: BrandedDocCtx, kicker: string): void {
  const { doc, letterhead, logoDataUri, logoAspect } = ctx;
  const BAND_H = 38;

  // Solid teal band across the top of the page.
  doc.setFillColor(...rgb(BRAND.teal));
  doc.rect(0, 0, PAGE.W, BAND_H, "F");

  // Right-aligned gold kicker label.
  doc.setTextColor(...rgb(BRAND.gold));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(kicker.toUpperCase(), PAGE.W - PAGE.MARGIN_R, 11, { align: "right" });

  // Logo (best-effort — skip silently if not loaded).
  let textX = PAGE.MARGIN_L;
  if (logoDataUri) {
    try {
      const logoH = 14;
      const logoW = logoAspect > 0 ? logoH / logoAspect : logoH;
      // Cap the logo width so a wide logo doesn't push the text off
      // the band.
      const safeW = Math.min(logoW, 32);
      const safeH = logoAspect > 0 ? safeW * logoAspect : logoH;
      doc.addImage(
        logoDataUri,
        "PNG",
        PAGE.MARGIN_L,
        BAND_H / 2 - safeH / 2,
        safeW,
        safeH,
        undefined,
        "FAST"
      );
      textX = PAGE.MARGIN_L + safeW + 5;
    } catch {
      // Bad image — fall through to text-only header.
      textX = PAGE.MARGIN_L;
    }
  }

  // Company name (cream on teal).
  doc.setTextColor(...rgb(BRAND.cream));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(letterhead.companyName, textX, 16);

  // Tagline + contact line under it.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(BRAND.goldSoft));
  if (letterhead.tagline) {
    doc.text(letterhead.tagline, textX, 22);
  }
  const contactBits = [letterhead.address, letterhead.phone, letterhead.email]
    .filter(Boolean)
    .join("  ·  ");
  if (contactBits) {
    doc.text(contactBits, textX, letterhead.tagline ? 27 : 22);
  }

  // Reset for content rendering.
  doc.setTextColor(...rgb(BRAND.ink));
  ctx.y = BAND_H + 8;
}

/** Section heading with a gold underline accent. */
export function drawSectionHeading(ctx: BrandedDocCtx, label: string): void {
  const { doc } = ctx;
  ensureSpace(ctx, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...rgb(BRAND.ink));
  doc.text(label, PAGE.MARGIN_L, ctx.y);
  ctx.y += 1.5;
  doc.setDrawColor(...rgb(BRAND.gold));
  doc.setLineWidth(0.5);
  doc.line(PAGE.MARGIN_L, ctx.y, PAGE.MARGIN_L + 18, ctx.y);
  doc.setLineWidth(0.2);
  doc.setDrawColor(...rgb(BRAND.border));
  ctx.y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
}

/** Wraps text to the content width and advances the cursor. */
export function drawWrapped(
  ctx: BrandedDocCtx,
  text: string,
  options?: { lineHeight?: number; indent?: number }
): void {
  const { doc } = ctx;
  const lh = options?.lineHeight ?? 4.5;
  const indent = options?.indent ?? 0;
  const wrapped = doc.splitTextToSize(text, CONTENT_W - indent);
  ensureSpace(ctx, wrapped.length * lh);
  doc.text(wrapped, PAGE.MARGIN_L + indent, ctx.y);
  ctx.y += wrapped.length * lh;
}

/**
 * Add a new page if the next `needed` mm of content wouldn't fit on
 * the current one.
 */
export function ensureSpace(ctx: BrandedDocCtx, needed: number): void {
  if (ctx.y + needed > PAGE_BOTTOM) {
    ctx.doc.addPage();
    ctx.y = PAGE.MARGIN_T;
  }
}

/**
 * After content is rendered, walk every page and stamp a footer with
 * the company contact line + page count. Run this once at the end —
 * NOT after each page — so the total page count is accurate.
 */
export function finalizeBrandedDoc(ctx: BrandedDocCtx): void {
  const { doc, letterhead } = ctx;
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    // Hairline divider above the footer.
    doc.setDrawColor(...rgb(BRAND.border));
    doc.setLineWidth(0.2);
    doc.line(
      PAGE.MARGIN_L,
      PAGE.H - PAGE.MARGIN_B + 4,
      PAGE.W - PAGE.MARGIN_R,
      PAGE.H - PAGE.MARGIN_B + 4
    );
    // Footer line: company name (left), page count (right).
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(BRAND.inkSoft));
    doc.text(
      letterhead.companyName,
      PAGE.MARGIN_L,
      PAGE.H - PAGE.MARGIN_B + 9
    );
    const right = letterhead.email
      ? `${letterhead.email}  ·  Page ${p} of ${total}`
      : `Page ${p} of ${total}`;
    doc.text(right, PAGE.W - PAGE.MARGIN_R, PAGE.H - PAGE.MARGIN_B + 9, {
      align: "right",
    });
  }
}

/** Convenience: serialize the doc to a Node Buffer for email/PDF download. */
export function brandedDocToBuffer(ctx: BrandedDocCtx): Buffer {
  const arrayBuffer = ctx.doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
