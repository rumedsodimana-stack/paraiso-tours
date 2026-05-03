import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPayment, getHotel } from "@/lib/db";
import { generatePaymentVoucherPdf } from "@/lib/voucher-pdf";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

/**
 * Download a branded payment voucher PDF for an outgoing supplier
 * payment. Mirrors the invoice/quotation PDF download routes.
 *
 * Returns 404 if the payment doesn't exist, 400 if it's an incoming
 * payment (vouchers are issued only for outgoing supplier remittances).
 * If the supplier record can be loaded, bank details are included on
 * the voucher; otherwise only the supplier name is rendered.
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
  const payment = await getPayment(id);
  if (!payment) {
    return NextResponse.json(
      { ok: false, error: "Payment not found" },
      { status: 404 }
    );
  }
  if (payment.type !== "outgoing") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Vouchers are only issued for outgoing supplier payments. For incoming payments, generate the invoice or receipt instead.",
      },
      { status: 400 }
    );
  }

  // Best-effort hydrate the supplier record so banking + contact
  // details can populate the "Paid to" card. If the supplier was
  // archived or the link broke, the voucher still renders with
  // supplierName from the payment row.
  const supplier = payment.supplierId ? await getHotel(payment.supplierId) : null;

  const pdf = await generatePaymentVoucherPdf({ payment, supplier });
  const ref = (payment.reference || payment.id).replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="voucher-${ref}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
