"use server";

import { recordAuditEvent } from "@/lib/audit";
import {
  generateAiJsonResult,
  generateAiText,
  maybeRaiseAiBudgetAlert,
} from "@/lib/ai";
import {
  buildAppArchitectureKnowledgeContext,
  buildAppUsageKnowledgeContext,
  buildWorkspaceCopilotCapabilitiesContext,
} from "@/lib/ai-app-knowledge";
import { buildAppDataContext } from "@/lib/ai-data-context";
import { buildFocusTerms, buildSriLankaKnowledgeContext } from "@/lib/ai-knowledge";
import { buildRagContext } from "@/lib/ai-rag";
import {
  coerceWorkspaceCopilotPlan,
  executeWorkspaceCopilotAction,
  type WorkspaceCopilotPlan,
} from "@/lib/ai-copilot";
import {
  buildBookingBriefPrompts,
  buildCoworkerCodePlanPrompts,
  buildJourneyAssistantPrompts,
  buildPackageWriterPrompts,
  buildWorkspaceCopilotPrompts,
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

function isCodeChangeRequest(request: string) {
  const normalized = request.toLowerCase();
  return [
    "add menu",
    "add sidebar",
    "edit code",
    "change code",
    "update code",
    "refactor",
    "build feature",
    "add feature",
    "change component",
    "update component",
    "create page",
    "edit file",
    "update file",
    "write code",
  ].some((term) => normalized.includes(term));
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

function describePlannedAction(plan: WorkspaceCopilotPlan["action"]) {
  switch (plan.type) {
    case "create_todo":
      return `Create todo: ${plan.title || "missing title"}`;
    case "update_booking_status":
      return `Update booking "${plan.bookingQuery || "missing booking"}" to ${plan.status || "missing status"}`;
    case "create_invoice_from_booking":
      return `Create invoice from booking "${plan.bookingQuery || "missing booking"}"`;
    case "schedule_tour_from_booking":
      return `Schedule tour from booking "${plan.bookingQuery || "missing booking"}"${plan.startDate ? ` on ${plan.startDate}` : ""}`;
    case "mark_invoice_paid":
      return `Mark invoice "${plan.invoiceQuery || "missing invoice"}" paid`;
    case "mark_payment_received":
      return `Mark payment "${plan.paymentQuery || "missing payment"}" received`;
    default:
      return "Answer only";
  }
}

export async function runAiToolAction(
  _prevState: AiToolActionState,
  formData: FormData
): Promise<AiToolActionState> {
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

    if (tool === "workspace_copilot") {
      const modelMode = getModelMode(formData);
      const request = String(formData.get("workspaceRequest") ?? "").trim();
      const executeRequested = formData.get("executeActions") === "on";
      const superpowerArmed = formData.get("superpowerEnabled") === "on";

      if (!request) {
        return { ok: false, message: "Enter the copilot request first." };
      }

      const [settings, hotels, packages] = await Promise.all([
        getAppSettings(),
        getHotels(),
        getPackages(),
      ]);
      const domainKnowledge = buildSriLankaKnowledgeContext({
        query: request,
        focusTerms: buildFocusTerms({ query: request }),
        packages,
        hotels,
        customNotes: settings.ai.knowledgeNotes,
      });
      const ragContext = await buildRagContext({
        query: request,
        tagHints: ["workspace", "copilot", "app usage", "operations"],
      });
      const dataKnowledge = await buildAppDataContext({
        query: request,
      });

      if (isCodeChangeRequest(request)) {
        if (!settings.ai.superpowerEnabled || !superpowerArmed) {
          const message =
            "Superpower is off. The AI coworker can explain or plan app changes, but it will not enter code-change mode until you explicitly arm Superpower in the chat settings.";
          const interaction = await persistInteraction({
            tool,
            requestText: request,
            responseText: message,
            executedOk: false,
            promotedToKnowledge: false,
            superpowerUsed: false,
            modelMode,
          });
          return {
            ok: true,
            message: "AI coworker stayed in protected mode.",
            result: message,
            title: "AI Coworker",
            tool,
            interactionId: interaction.id,
          };
        }

        const prompts = buildCoworkerCodePlanPrompts({
          request,
          architectureKnowledge: buildAppArchitectureKnowledgeContext(),
          usageKnowledge: buildAppUsageKnowledgeContext(),
          capabilitiesKnowledge: buildWorkspaceCopilotCapabilitiesContext(),
          dataKnowledge: [dataKnowledge, ragContext].filter(Boolean).join("\n\n"),
          domainKnowledge,
        });
        const response = await generateAiText({
          feature: "workspace_copilot",
          title: prompts.title,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
          modelMode: modelMode === "auto" ? "heavy" : modelMode,
          usePromptCache: true,
        });

        await recordAuditEvent({
          entityType: "system",
          entityId: "ai_workspace_copilot",
          action: "ai_coworker_superpower_requested",
          summary: "AI coworker prepared a guarded app-build handoff",
          actor: "Admin AI Workspace",
          details: [
            "Mode: Superpower",
            `Model: ${response.model}`,
            `Provider: ${response.providerLabel}`,
          ],
        });

        const interaction = await persistInteraction({
          tool,
          requestText: request,
          responseText: response.text,
          executedOk: false,
          promotedToKnowledge: false,
          providerLabel: response.providerLabel,
          model: response.model,
          modelMode: response.modelMode,
          superpowerUsed: true,
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
          cacheCreationInputTokens: response.usage?.cacheCreationInputTokens,
          cacheReadInputTokens: response.usage?.cacheReadInputTokens,
          estimatedCostUsd: response.estimatedCostUsd,
        });

        return {
          ok: true,
          message:
            "AI coworker prepared a guarded app-build handoff. No files were edited inside the app runtime.",
          result: response.text,
          title: "AI Coworker",
          tool,
          interactionId: interaction.id,
        };
      }

      const prompts = buildWorkspaceCopilotPrompts({
        request,
        executeRequested,
        architectureKnowledge: buildAppArchitectureKnowledgeContext(),
        usageKnowledge: buildAppUsageKnowledgeContext(),
        capabilitiesKnowledge: buildWorkspaceCopilotCapabilitiesContext(),
        dataKnowledge: [dataKnowledge, ragContext].filter(Boolean).join("\n\n"),
        domainKnowledge,
      });
      const { data: rawPlan, response } =
        await generateAiJsonResult<WorkspaceCopilotPlan>({
        feature: "workspace_copilot",
        title: prompts.title,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        modelMode,
        usePromptCache: true,
      });
      const plan = coerceWorkspaceCopilotPlan(rawPlan);

      await recordAuditEvent({
        entityType: "system",
        entityId: "ai_workspace_copilot",
        action: "ai_workspace_copilot_used",
        summary: "AI workspace copilot request processed",
        actor: "Admin AI Studio",
        details: [
          `Planned action: ${describePlannedAction(plan.action)}`,
          `Execution requested: ${executeRequested ? "Yes" : "No"}`,
        ],
      });

      let executionDetails = "";
      if (!executeRequested || plan.action.type === "answer_only") {
        const interaction = await persistInteraction({
          tool,
          requestText: request,
          responseText: plan.response,
          plannedAction: plan.action,
          executedOk: false,
          promotedToKnowledge: false,
          providerLabel: response.providerLabel,
          model: response.model,
          modelMode: response.modelMode,
          superpowerUsed: false,
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
          cacheCreationInputTokens: response.usage?.cacheCreationInputTokens,
          cacheReadInputTokens: response.usage?.cacheReadInputTokens,
          estimatedCostUsd: response.estimatedCostUsd,
        });
        return {
          ok: true,
          message:
            plan.action.type === "answer_only"
              ? "Copilot response ready."
              : "Copilot plan ready. No action executed.",
          result: [
            plan.response,
            plan.action.type !== "answer_only"
              ? `Planned action: ${describePlannedAction(plan.action)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          title: "AI Coworker",
          tool,
          interactionId: interaction.id,
        };
      }

      const execution = await executeWorkspaceCopilotAction(plan.action);
      executionDetails = execution.details ?? "";
      const interaction = await persistInteraction({
        tool,
        requestText: request,
        responseText: [plan.response, execution.details].filter(Boolean).join("\n\n"),
        plannedAction: plan.action,
        executedOk: execution.ok,
        promotedToKnowledge: false,
        providerLabel: response.providerLabel,
        model: response.model,
        modelMode: response.modelMode,
        superpowerUsed: false,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        cacheCreationInputTokens: response.usage?.cacheCreationInputTokens,
        cacheReadInputTokens: response.usage?.cacheReadInputTokens,
        estimatedCostUsd: response.estimatedCostUsd,
      });
      return {
        ok: execution.ok,
        message: execution.message,
        result: [plan.response, executionDetails].filter(Boolean).join("\n\n"),
        title: "AI Coworker",
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
