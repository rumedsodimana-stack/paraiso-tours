"use server";

import { recordAuditEvent } from "@/lib/audit";
import { generateAiText, maybeRaiseAiBudgetAlert } from "@/lib/ai";
import { buildFocusTerms, buildSriLankaKnowledgeContext } from "@/lib/ai-knowledge";
import { buildRagContext } from "@/lib/ai-rag";
import {
  buildBookingBriefPrompts,
  buildJourneyAssistantPrompts,
  buildPackageWriterPrompts,
} from "@/lib/ai-prompts";
import { getAppSettings } from "@/lib/app-config";
import {
  createAiInteraction,
  getInvoiceByLeadId,
  getLead,
  getHotels,
  getPackage,
  getPackages,
} from "@/lib/db";
import { resolveLeadPackage } from "@/lib/package-snapshot";
import type { AiModelMode } from "@/lib/types";
import { requireAdmin } from "@/lib/admin-session";

export interface AiToolActionState {
  ok: boolean;
  message: string;
  result?: string;
  title?: string;
  tool?: string;
  interactionId?: string;
}

function getModelMode(formData: FormData): AiModelMode {
  const raw = String(formData.get("modelMode") ?? "").trim();
  return raw === "simple" || raw === "default" || raw === "heavy"
    ? raw
    : "auto";
}


async function persistInteraction(input: {
  tool: string;
  requestText: string;
  responseText: string;
  plannedAction?: Record<string, unknown>;
  executedOk?: boolean;
  promotedToKnowledge?: boolean;
  providerLabel?: string;
  model?: string;
  modelMode?: AiModelMode;
  superpowerUsed?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  estimatedCostUsd?: number;
}) {
  const interaction = await createAiInteraction({
    tool: input.tool,
    requestText: input.requestText,
    responseText: input.responseText,
    plannedAction: input.plannedAction,
    executedOk: input.executedOk,
    promotedToKnowledge: input.promotedToKnowledge ?? false,
    providerLabel: input.providerLabel,
    model: input.model,
    modelMode: input.modelMode,
    superpowerUsed: input.superpowerUsed,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cacheCreationInputTokens: input.cacheCreationInputTokens,
    cacheReadInputTokens: input.cacheReadInputTokens,
    estimatedCostUsd: input.estimatedCostUsd,
  });
  await maybeRaiseAiBudgetAlert();
  return interaction;
}

export async function runAiToolAction(
  _prevState: AiToolActionState,
  formData: FormData
): Promise<AiToolActionState> {
  await requireAdmin();
  const tool = String(formData.get("tool") ?? "").trim();

  try {
    if (tool === "booking_brief") {
      const modelMode = getModelMode(formData);
      const leadId = String(formData.get("leadId") ?? "").trim();
      if (!leadId) {
        return { ok: false, message: "Select a booking first." };
      }

      const lead = await getLead(leadId);
      if (!lead) {
        return { ok: false, message: "Booking not found." };
      }

      const [livePackage, invoice, hotels, packages, settings] = await Promise.all([
        lead.packageId ? getPackage(lead.packageId) : Promise.resolve(null),
        getInvoiceByLeadId(lead.id),
        getHotels(),
        getPackages(),
        getAppSettings(),
      ]);
      const pkg = resolveLeadPackage(lead, livePackage);
      const knowledgeContext = buildSriLankaKnowledgeContext({
        query: [lead.destination, lead.notes, lead.name].filter(Boolean).join(" "),
        focusTerms: buildFocusTerms({
          destination: lead.destination,
          packageName: pkg?.name,
          itineraryTitles: pkg?.itinerary?.map((day) => day.title),
          notes: lead.notes,
        }),
        packages,
        hotels,
        travelDate: lead.travelDate,
        pax: lead.pax,
        customNotes: settings.ai.knowledgeNotes,
      });
      const ragContext = await buildRagContext({
        query: [lead.reference, lead.name, lead.destination, lead.notes, pkg?.name]
          .filter(Boolean)
          .join(" "),
        tagHints: ["booking", "customer care", "operations", "sri lanka"],
      });
      const prompts = buildBookingBriefPrompts({
        lead,
        pkg,
        invoice,
        knowledgeContext: [knowledgeContext, ragContext]
          .filter(Boolean)
          .join("\n\n"),
      });
      const response = await generateAiText({
        feature: "booking_brief",
        title: prompts.title,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        modelMode,
        usePromptCache: true,
      });

      await recordAuditEvent({
        entityType: "lead",
        entityId: lead.id,
        action: "ai_booking_brief_generated",
        summary: `AI booking brief generated for ${lead.name}`,
        actor: "Admin AI Studio",
        details: [
          `Tool: Booking brief`,
          `Model: ${response.model}`,
          `Provider: ${response.providerLabel}`,
        ],
      });
      const interaction = await persistInteraction({
        tool,
        requestText: `Generate booking brief for ${lead.reference ?? lead.id}`,
        responseText: response.text,
        promotedToKnowledge: false,
        providerLabel: response.providerLabel,
        model: response.model,
        modelMode: response.modelMode,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cacheCreationInputTokens: response.usage?.cacheCreationInputTokens,
        cacheReadInputTokens: response.usage?.cacheReadInputTokens,
        estimatedCostUsd: response.estimatedCostUsd,
      });

      return {
        ok: true,
        message: "AI booking brief ready.",
        result: response.text,
        title: `Booking Brief · ${lead.reference ?? lead.name}`,
        tool,
        interactionId: interaction.id,
      };
    }

    if (tool === "package_writer") {
      const modelMode = getModelMode(formData);
      const packageId = String(formData.get("packageId") ?? "").trim();
      if (!packageId) {
        return { ok: false, message: "Select a package first." };
      }

      const pkg = await getPackage(packageId);
      if (!pkg) {
        return { ok: false, message: "Package not found." };
      }

      const [hotels, packages, settings] = await Promise.all([
        getHotels(),
        getPackages(),
        getAppSettings(),
      ]);
      const knowledgeContext = buildSriLankaKnowledgeContext({
        query: [pkg.name, pkg.destination, pkg.region, pkg.description]
          .filter(Boolean)
          .join(" "),
        focusTerms: buildFocusTerms({
          destination: pkg.destination,
          packageName: pkg.name,
          itineraryTitles: pkg.itinerary?.map((day) => day.title),
          notes: pkg.description,
        }),
        packages,
        hotels,
        customNotes: settings.ai.knowledgeNotes,
      });
      const ragContext = await buildRagContext({
        query: [pkg.name, pkg.destination, pkg.region, pkg.description]
          .filter(Boolean)
          .join(" "),
        tagHints: ["package", "sales", "email", "customer care"],
      });
      const prompts = buildPackageWriterPrompts(
        pkg,
        [knowledgeContext, ragContext].filter(Boolean).join("\n\n")
      );
      const response = await generateAiText({
        feature: "package_writer",
        title: prompts.title,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        modelMode,
        usePromptCache: true,
      });

      await recordAuditEvent({
        entityType: "package",
        entityId: pkg.id,
        action: "ai_package_writer_generated",
        summary: `AI package copy generated for ${pkg.name}`,
        actor: "Admin AI Studio",
        details: [
          `Tool: Package writer`,
          `Model: ${response.model}`,
          `Provider: ${response.providerLabel}`,
        ],
      });
      const interaction = await persistInteraction({
        tool,
        requestText: `Generate package copy for ${pkg.name}`,
        responseText: response.text,
        promotedToKnowledge: false,
        providerLabel: response.providerLabel,
        model: response.model,
        modelMode: response.modelMode,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cacheCreationInputTokens: response.usage?.cacheCreationInputTokens,
        cacheReadInputTokens: response.usage?.cacheReadInputTokens,
        estimatedCostUsd: response.estimatedCostUsd,
      });

      return {
        ok: true,
        message: "AI package draft ready.",
        result: response.text,
        title: `Package Writer · ${pkg.name}`,
        tool,
        interactionId: interaction.id,
      };
    }

    if (tool === "journey_assistant") {
      const modelMode = getModelMode(formData);
      const request = String(formData.get("journeyRequest") ?? "").trim();
      const travelDate = String(formData.get("travelDate") ?? "").trim();
      const paxRaw = String(formData.get("pax") ?? "").trim();
      const pax = paxRaw ? Number.parseInt(paxRaw, 10) : undefined;

      if (!request) {
        return { ok: false, message: "Enter the guest brief first." };
      }

      const [hotels, packages, settings] = await Promise.all([
        getHotels(),
        getPackages(),
        getAppSettings(),
      ]);
      const knowledgeContext = buildSriLankaKnowledgeContext({
        query: request,
        focusTerms: buildFocusTerms({ query: request }),
        packages,
        hotels,
        travelDate: travelDate || undefined,
        pax: Number.isFinite(pax) ? pax : undefined,
        customNotes: settings.ai.knowledgeNotes,
      });
      const ragContext = await buildRagContext({
        query: request,
        tagHints: ["journey", "route", "sri lanka", "customer care"],
      });
      const prompts = buildJourneyAssistantPrompts({
        request,
        travelDate: travelDate || undefined,
        pax: Number.isFinite(pax) ? pax : undefined,
        knowledgeContext: [knowledgeContext, ragContext]
          .filter(Boolean)
          .join("\n\n"),
      });
      const response = await generateAiText({
        feature: "journey_assistant",
        title: prompts.title,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        modelMode,
        usePromptCache: true,
      });

      await recordAuditEvent({
        entityType: "system",
        entityId: "ai_journey_assistant",
        action: "ai_journey_assistant_generated",
        summary: "AI journey guidance generated",
        actor: "Admin AI Studio",
        details: [
          `Tool: Journey assistant`,
          `Model: ${response.model}`,
          `Provider: ${response.providerLabel}`,
        ],
        metadata: {
          travelDate: travelDate || null,
          pax: Number.isFinite(pax) ? pax : null,
        },
      });
      const interaction = await persistInteraction({
        tool,
        requestText: request,
        responseText: response.text,
        promotedToKnowledge: false,
        providerLabel: response.providerLabel,
        model: response.model,
        modelMode: response.modelMode,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cacheCreationInputTokens: response.usage?.cacheCreationInputTokens,
        cacheReadInputTokens: response.usage?.cacheReadInputTokens,
        estimatedCostUsd: response.estimatedCostUsd,
      });

      return {
        ok: true,
        message: "AI journey guidance ready.",
        result: response.text,
        title: "Journey Assistant",
        tool,
        interactionId: interaction.id,
      };
    }

    return {
      ok: false,
      message: "Unknown AI tool request.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "AI request failed.",
    };
  }
}
