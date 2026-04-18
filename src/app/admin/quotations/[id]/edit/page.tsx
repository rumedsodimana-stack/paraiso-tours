import { notFound, redirect } from "next/navigation";
import { getQuotation } from "@/lib/db";
import { QuotationForm } from "../../QuotationForm";
import { updateQuotationAction } from "@/app/actions/quotations";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await Promise.resolve(params);
  const quotation = await getQuotation(id);
  if (!quotation) notFound();
  if (quotation.status === "accepted") redirect(`/admin/quotations/${id}`);

  const action = async (formData: FormData) => {
    "use server";
    return updateQuotationAction(id, formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/quotations/${id}`}
          className="inline-flex items-center gap-1 text-sm text-[#5e7279] hover:text-[#11272b]"
        >
          <ChevronLeft className="h-4 w-4" />
          {quotation.reference}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-[#11272b]">Edit Quotation</h1>
        <p className="mt-1 text-[#5e7279]">{quotation.reference}</p>
      </div>

      <QuotationForm mode="edit" initial={quotation} action={action} />
    </div>
  );
}
