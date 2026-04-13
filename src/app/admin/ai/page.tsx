import { getAiRuntimeStatus } from "@/lib/ai";
import { getAiInteractions, getAiKnowledgeDocuments, getLeads, getPackages } from "@/lib/db";
import { AiCowork } from "./AiCowork";

export const dynamic = "force-dynamic";

export interface ConnectorStatus {
  id: string;
  label: string;
  description: string;
  connected: boolean;
  category: "ai" | "messaging" | "data" | "webhook";
}

function getConnectors(runtime: { configured: boolean; enabled: boolean; providerLabel: string }): ConnectorStatus[] {
  return [
    {
      id: "ai",
      label: runtime.providerLabel || "AI Provider",
      description: "Powers AI responses and actions",
      connected: runtime.configured && runtime.enabled,
      category: "ai",
    },
    {
      id: "email",
      label: "Email (Resend)",
      description: "Send invoices & confirmations",
      connected: !!(process.env.RESEND_API_KEY?.trim()),
      category: "messaging",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      description: "Client messaging via Meta API",
      connected: !!(
        process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      ),
      category: "messaging",
    },
    {
      id: "whatsapp_webhook",
      label: "WA Webhook",
      description: "Inbound WhatsApp messages",
      connected: !!(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()),
      category: "webhook",
    },
    {
      id: "database",
      label: "Supabase DB",
      description: "Primary data store",
      connected: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ),
      category: "data",
    },
  ];
}

export default async function AdminAiPage() {
  const [runtime, leads, packages, knowledgeDocuments, interactions] = await Promise.all([
    getAiRuntimeStatus(),
    getLeads(),
    getPackages(),
    getAiKnowledgeDocuments(),
    getAiInteractions(12),
  ]);

  const connectors = getConnectors(runtime);

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
    <AiCowork
      runtime={runtime}
      bookings={bookingOptions}
      packages={packageOptions}
      knowledgeDocuments={knowledgeDocuments.slice(0, 12)}
      interactions={interactions}
      connectors={connectors}
    />
  );
}
