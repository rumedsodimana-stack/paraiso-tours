/**
 * Generic branded report PDF builder. Renders any tabular report
 * (P&L, supplier statement, booking revenue, payroll register, future
 * reports) with the same brand kit as invoices, itineraries,
 * quotations, and vouchers via lib/pdf-letterhead.ts.
 *
 * Layout:
 *   1. Coloured navy header band with REPORT kicker
 *   2. Report title + date range + generated-at timestamp
 *   3. Optional summary stat cards (each shows label + big value)
 *   4. Tabular data — header row in gold, zebra row fills, optional
 *      "highlight" rows for totals/footers
 *   5. Optional footnote
 *   6. Footer (drawn via finalizeBrandedDoc) with page count
 *
 * Usage:
 *   const pdf = await generateReportPdf({
 *     kicker: "Profit & Loss",
 *     title: "P&L statement",
 *     dateRange: { from: "2026-04-01", to: "2026-04-30" },
 *     stats: [
 *       { label: "Inbound", value: "$45,200" },
 *       { label: "Outbound", value: "$28,800" },
 *       { label: "Net", value: "$16,400", emphasis: true },
 *     ],
 *     columns: [
 *       { key: "date", label: "Date", width: 0.13 },
 *       { key: "party", label: "Party", width: 0.32 },
 *       { key: "amount", label: "Amount", width: 0.18, align: "right", numeric: true },
 *       ...
 *     ],
 *     rows: [...],
 *   });
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

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
  return [c.r, c.g, c.b];
}

function formatLongDate(iso: string | undefined): string {
  if (!iso) return "—";
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

export interface ReportSummaryStat {
  label: string;
  value: string;
  /** When true, the stat gets the gold-tinted background to draw the
   *  eye to the headline number (e.g. Net Profit, Total Paid). */
  emphasis?: boolean;
}

export interface ReportColumn {
  /** Field name on each row in `rows`. */
  key: string;
  /** Header label for the column. */
  label: string;
  /** Fraction of the table width (0..1). All columns must sum to 1.0
   *  (or close — small rounding is fine). */
  width: number;
  /** Horizontal alignment of the cell value. Defaults to left. */
  align?: "left" | "right" | "center";
  /** When true, the cell is rendered in monospace-ish bold style
   *  reserved for currency/numeric values that should line up
   *  visually. Only affects display, not value parsing. */
  numeric?: boolean;
}

/**
 * Row data keyed by column.key. Values are coerced to strings via
 * String() before rendering. Use the `__highlight` truthy flag (any
 * non-empty string or non-zero number) to render the row with a
 * gold-tinted background and bold text — used for "TOTAL", "PAID",
 * "NET" footer rows.
 */
export type ReportRow = {
  [key: string]: string | number | null | undefined;
};

export interface GenerateReportPdfInput {
  /** Gold kicker label in the header band, e.g. "Profit & Loss" or
   *  "Supplier statement". Auto-uppercased by the letterhead helper. */
  kicker: string;
  /** Big bold title under the header band. */
  title: string;
  /** Optional subtitle line directly under the title — typically used
   *  for the "for [Supplier name]" / "all suppliers" qualifier. */
  subtitle?: string;
  /** When provided, formatted as "From X to Y" under the title. */
  dateRange?: {
    from?: string;
    to?: string;
  };
  /** Optional summary stat cards rendered above the table. Lay out
   *  3-up on wide content; wraps gracefully for fewer/more stats. */
  stats?: ReportSummaryStat[];
  /** Column definitions for the table. */
  columns: ReportColumn[];
  /** Row data. Empty array → "No matching records" placeholder shown. */
  rows: ReportRow[];
  /** Optional footnote rendered after the table. */
  footnote?: string;
}

export async function generateReportPdf(
  input: GenerateReportPdfInput
): Promise<Buffer> {
  const ctx = await initBrandedDoc();
  const { doc } = ctx;

  drawHeaderBand(ctx, input.kicker);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...rgb(BRAND.ink));
  const wrappedTitle = doc.splitTextToSize(input.title, CONTENT_W);
  doc.text(wrappedTitle, PAGE.MARGIN_L, ctx.y);
  ctx.y += wrappedTitle.length * 7;

  // Subtitle (optional)
  if (input.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...rgb(BRAND.inkSoft));
    doc.text(input.subtitle, PAGE.MARGIN_L, ctx.y);
    ctx.y += 5.5;
  }

  // Meta line: generated timestamp + date range
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...rgb(BRAND.inkSoft));
  const metaBits: string[] = [`Generated ${formatLongDate(new Date().toISOString())}`];
  if (input.dateRange?.from || input.dateRange?.to) {
    const from = formatLongDate(input.dateRange?.from);
    const to = formatLongDate(input.dateRange?.to);
    metaBits.push(`Range ${from} → ${to}`);
  }
  doc.text(metaBits.join("   ·   "), PAGE.MARGIN_L, ctx.y);
  ctx.y += 8;

  // Summary stat cards (optional, lay out up to 3 per row)
  if (input.stats && input.stats.length > 0) {
    renderStatCards(ctx, input.stats);
    ctx.y += 4;
  }

  // Table
  renderReportTable(ctx, input.columns, input.rows);

  // Footnote
  if (input.footnote) {
    ensureSpace(ctx, 10);
    ctx.y += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(BRAND.inkSoft));
    const wrapped = doc.splitTextToSize(input.footnote, CONTENT_W);
    doc.text(wrapped, PAGE.MARGIN_L, ctx.y);
    ctx.y += wrapped.length * 4.5;
  }

  finalizeBrandedDoc(ctx);
  return brandedDocToBuffer(ctx);
}

// ── Helpers ───────────────────────────────────────────────────────

function renderStatCards(
  ctx: Awaited<ReturnType<typeof initBrandedDoc>>,
  stats: ReportSummaryStat[]
): void {
  const { doc } = ctx;
  // Layout: up to 3 cards per row; 4+ stats wrap to a second row.
  const perRow = Math.min(stats.length, 3);
  const gap = 4;
  const cardW = (CONTENT_W - gap * (perRow - 1)) / perRow;
  const cardH = 22;
  const rowsCount = Math.ceil(stats.length / perRow);
  ensureSpace(ctx, rowsCount * (cardH + gap) + 4);

  stats.forEach((stat, idx) => {
    const col = idx % perRow;
    const row = Math.floor(idx / perRow);
    const x = PAGE.MARGIN_L + col * (cardW + gap);
    const y = ctx.y + row * (cardH + gap);

    if (stat.emphasis) {
      doc.setFillColor(...rgb(BRAND.goldSoft));
    } else {
      doc.setFillColor(...rgb(BRAND.cream));
    }
    doc.setDrawColor(...rgb(BRAND.border));
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

    // Label (small, gold, uppercase)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(BRAND.gold));
    doc.text(stat.label.toUpperCase(), x + 5, y + 6);

    // Value (big, teal)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(stat.emphasis ? 16 : 14);
    doc.setTextColor(...rgb(BRAND.teal));
    // Truncate values that would overflow the card.
    const maxValueWidth = cardW - 10;
    let value = stat.value;
    if (doc.getTextWidth(value) > maxValueWidth) {
      // Trim until it fits + ellipsis.
      while (
        doc.getTextWidth(value + "…") > maxValueWidth &&
        value.length > 0
      ) {
        value = value.slice(0, -1);
      }
      value += "…";
    }
    doc.text(value, x + 5, y + cardH - 5);
  });
  ctx.y += rowsCount * (cardH + gap);
}

function renderReportTable(
  ctx: Awaited<ReturnType<typeof initBrandedDoc>>,
  columns: ReportColumn[],
  rows: ReportRow[]
): void {
  const { doc } = ctx;
  const ROW_H = 7;

  // Pre-compute column x positions based on widths.
  const colXs: number[] = [];
  let acc = PAGE.MARGIN_L;
  for (const c of columns) {
    colXs.push(acc);
    acc += CONTENT_W * c.width;
  }
  // Right edge for the last column's right-aligned text.
  const rightEdge = PAGE.W - PAGE.MARGIN_R;

  // Header
  ensureSpace(ctx, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(BRAND.gold));
  columns.forEach((c, i) => {
    const x =
      c.align === "right"
        ? i === columns.length - 1
          ? rightEdge
          : colXs[i] + CONTENT_W * c.width - 1
        : c.align === "center"
          ? colXs[i] + (CONTENT_W * c.width) / 2
          : colXs[i];
    doc.text(c.label.toUpperCase(), x, ctx.y, {
      align: c.align ?? "left",
    });
  });
  ctx.y += 2;
  doc.setDrawColor(...rgb(BRAND.gold));
  doc.setLineWidth(0.4);
  doc.line(PAGE.MARGIN_L, ctx.y, rightEdge, ctx.y);
  doc.setLineWidth(0.2);
  doc.setDrawColor(...rgb(BRAND.border));
  ctx.y += 4;

  // Empty state
  if (rows.length === 0) {
    ensureSpace(ctx, 14);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...rgb(BRAND.inkSoft));
    doc.text(
      "No matching records for the selected range.",
      PAGE.MARGIN_L + CONTENT_W / 2,
      ctx.y + 4,
      { align: "center" }
    );
    ctx.y += 10;
    return;
  }

  // Data rows
  rows.forEach((row, idx) => {
    const isHighlight = !!row.__highlight;
    // Determine row height — wrap text within each cell to avoid
    // truncation. Row height is the max wrapped line count across
    // all cells * line height.
    const cellWraps = columns.map((c) => {
      const raw = row[c.key];
      const text = raw == null ? "" : String(raw);
      const cellW = CONTENT_W * c.width - 4;
      return doc.splitTextToSize(text, cellW);
    });
    const lineCount = Math.max(1, ...cellWraps.map((w) => w.length));
    const rowHeight = Math.max(ROW_H, lineCount * 4.5 + 2);
    ensureSpace(ctx, rowHeight + 1);

    // Row fill: zebra (cream) or highlight (goldSoft).
    if (isHighlight) {
      doc.setFillColor(...rgb(BRAND.goldSoft));
      doc.rect(
        PAGE.MARGIN_L - 2,
        ctx.y - 4,
        CONTENT_W + 4,
        rowHeight,
        "F"
      );
    } else if (idx % 2 === 0) {
      doc.setFillColor(...rgb(BRAND.cream));
      doc.rect(
        PAGE.MARGIN_L - 2,
        ctx.y - 4,
        CONTENT_W + 4,
        rowHeight,
        "F"
      );
    }

    doc.setFont("helvetica", isHighlight ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...rgb(isHighlight ? BRAND.ink : BRAND.ink));

    columns.forEach((c, i) => {
      const wrap = cellWraps[i];
      const x =
        c.align === "right"
          ? i === columns.length - 1
            ? rightEdge
            : colXs[i] + CONTENT_W * c.width - 1
          : c.align === "center"
            ? colXs[i] + (CONTENT_W * c.width) / 2
            : colXs[i];
      // Numeric columns get bold weight even on non-highlight rows
      // for visual alignment.
      if (c.numeric && !isHighlight) {
        doc.setFont("helvetica", "bold");
      } else if (!isHighlight) {
        doc.setFont("helvetica", "normal");
      }
      doc.text(wrap, x, ctx.y, {
        align: c.align ?? "left",
      });
    });
    ctx.y += rowHeight - 4;
  });
}
