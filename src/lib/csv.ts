/**
 * Simple CSV helpers — RFC-4180-style quoting, no external deps.
 */

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: CsvRow[], columns?: string[]): string {
  if (rows.length === 0 && !columns) return "";
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const header = cols.map(escapeCell).join(",");
  const body = rows.map((row) => cols.map((c) => escapeCell(row[c])).join(","));
  return [header, ...body].join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
