function timestampPart(date = new Date()): string {
  return date.toISOString().replace(/\D/g, "").slice(0, 14);
}

function randomPart(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function generateDocumentNumber(prefix: string, date = new Date()): string {
  return `${prefix}-${timestampPart(date)}-${randomPart()}`;
}
