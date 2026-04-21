import Link from "next/link";
import { Download, FileSpreadsheet, Landmark, Users, Wallet } from "lucide-react";
import { getHotels } from "@/lib/db";
import { ReportRunner } from "./ReportRunner";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const hotels = await getHotels();
  const suppliers = hotels.map((h) => ({ id: h.id, name: h.name, type: h.type }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <FileSpreadsheet className="h-6 w-6 text-[#12343b]" />
          Reports
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Exportable P&amp;L, supplier statements, booking revenue, and payroll register.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportCard
          icon={Landmark}
          title="P&amp;L statement"
          body="Completed payments in/out of the business within a date range. Rolls up net profit."
        >
          <ReportRunner kind="pl" label="Download P&L (.csv)" />
        </ReportCard>

        <ReportCard
          icon={Users}
          title="Supplier statement"
          body="All outgoing payments for a single supplier — paid, pending, and totals."
        >
          <ReportRunner kind="supplier_statement" label="Download statement (.csv)" suppliers={suppliers} />
        </ReportCard>

        <ReportCard
          icon={Download}
          title="Booking revenue"
          body="Every scheduled tour with package, dates, pax, total, invoice number, and status."
        >
          <ReportRunner kind="booking_revenue" label="Download bookings (.csv)" />
        </ReportCard>

        <ReportCard
          icon={Wallet}
          title="Payroll register"
          body="Line-level payroll register across runs — employee, gross, tax, benefits, net."
        >
          <ReportRunner kind="payroll_register" label="Download payroll (.csv)" />
        </ReportCard>
      </div>
    </div>
  );
}

function ReportCard({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section className="paraiso-card rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4f4] text-[#12343b]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-[#11272b]" dangerouslySetInnerHTML={{ __html: title }} />
          <p className="mt-1 text-sm leading-6 text-[#5e7279]">{body}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function _preventUnusedLink() {
  return Link;
}
