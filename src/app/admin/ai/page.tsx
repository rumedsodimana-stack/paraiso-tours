import { getAiRuntimeStatus } from "@/lib/ai";
import { getAiInteractions, getAiKnowledgeDocuments, getLeads, getPackages } from "@/lib/db";
import { AiStudio } from "./AiStudio";

export const dynamic = "force-dynamic";

type AiTool =
  | "booking_brief"
  | "package_writer"
  | "journey_assistant"
  | "workspace_copilot";

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tool?: string;
    leadId?: string;
    packageId?: string;
  }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const requestedTool: AiTool =
    resolved?.tool === "package_writer" ||
    resolved?.tool === "journey_assistant" ||
    resolved?.tool === "workspace_copilot"
      ? resolved.tool
      : "booking_brief";

  const [runtime, leads, packages, knowledgeDocuments, interactions] = await Promise.all([
    getAiRuntimeStatus(),
    getLeads(),
    getPackages(),
    getAiKnowledgeDocuments(),
    getAiInteractions(12),
  ]);

  const bookingOptions = [...leads]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 150)
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      reference: lead.reference,
      status: lead.status,
      travelDate: lead.travelDate,
    }));

  const packageOptions = [...packages]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      destination: pkg.destination,
      duration: pkg.duration,
      price: pkg.price,
      currency: pkg.currency,
    }));

  return (
    <AiStudio
      runtime={runtime}
      bookings={bookingOptions}
      packages={packageOptions}
      knowledgeDocuments={knowledgeDocuments.slice(0, 12)}
      interactions={interactions}
      initialTool={requestedTool}
      initialLeadId={resolved?.leadId}
      initialPackageId={resolved?.packageId}
    />
  );
}
