import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getQuotation } from "@/lib/db";
import { generateQuotationPdf } from "@/lib/quotation-pdf";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

/**
 * Download a quotation as a branded PDF. Mirrors the
 * /api/admin/invoices/[id]/pdf route — same auth pattern, same
 * cache headers, same filename-safe slug. The PDF is generated on
 * each request (no caching) so the latest line items, status, and
 * branding always reflect the current state.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const session = await verifyAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  );

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const quotation = await getQuotation(id);
  if (!quotation) {
    return NextResponse.json(
      { ok: false, error: "Quotation not found" },
      { status: 404 }
    );
  }

  const pdf = await generateQuotationPdf(quotation);
  const safeFileName = `quotation-${quotation.reference.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
