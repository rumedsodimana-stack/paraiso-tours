import { QuotationForm } from "../QuotationForm";
import { createQuotationAction } from "@/app/actions/quotations";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewQuotationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/quotations"
          className="inline-flex items-center gap-1 text-sm text-[#5e7279] hover:text-[#11272b]"
        >
          <ChevronLeft className="h-4 w-4" />
          Quotations
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-[#11272b]">New Quotation</h1>
        <p className="mt-1 text-[#5e7279]">
          Build a custom tour proposal for a corporate or group client.
        </p>
      </div>

      <QuotationForm mode="create" action={createQuotationAction} />
    </div>
  );
}
