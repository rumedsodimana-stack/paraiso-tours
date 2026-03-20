"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit";
import { getAppSettings } from "@/lib/app-config";
import {
  createAiKnowledgeDocument,
  getAiInteraction,
  updateAiInteraction,
} from "@/lib/db";

export interface AiKnowledgeActionState {
  ok: boolean;
  message: string;
}

export async function createAiKnowledgeDocumentAction(
  _prevState: AiKnowledgeActionState,
  formData: FormData
): Promise<AiKnowledgeActionState> {
  try {
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!title || !content) {
      return {
        ok: false,
        message: "Title and content are required.",
      };
    }

    const document = await createAiKnowledgeDocument({
      title,
      content,
      sourceType: "manual",
      tags,
      active: true,
    });

    await recordAuditEvent({
      entityType: "system",
      entityId: "ai_knowledge",
      action: "ai_knowledge_document_created",
      summary: `AI knowledge document added: ${document.title}`,
      actor: "Admin AI Studio",
      details: [`Source: manual`, `Tags: ${(document.tags ?? []).join(", ") || "None"}`],
    });

    revalidatePath("/admin/ai");
    return {
      ok: true,
      message: "Knowledge document saved.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to save knowledge.",
    };
  }
}

export async function saveAiInteractionFeedbackAction(
  _prevState: AiKnowledgeActionState,
  formData: FormData
): Promise<AiKnowledgeActionState> {
  try {
    const interactionId = String(formData.get("interactionId") ?? "").trim();
    const helpfulValue = String(formData.get("helpful") ?? "").trim();
    const feedbackNotes = String(formData.get("feedbackNotes") ?? "").trim();
    const helpful =
      helpfulValue === "true" ? true : helpfulValue === "false" ? false : undefined;

    if (!interactionId || helpful === undefined) {
      return {
        ok: false,
        message: "Feedback request is incomplete.",
      };
    }

    const updated = await updateAiInteraction(interactionId, {
      helpful,
      feedbackNotes: feedbackNotes || undefined,
    });
    if (!updated) {
      return {
        ok: false,
        message: "Interaction not found.",
      };
    }

    await recordAuditEvent({
      entityType: "system",
      entityId: "ai_knowledge",
      action: helpful ? "ai_feedback_positive" : "ai_feedback_negative",
      summary: `AI interaction marked ${helpful ? "useful" : "not useful"}`,
      actor: "Admin AI Studio",
      details: [`Tool: ${updated.tool}`],
    });

    revalidatePath("/admin/ai");
    return {
      ok: true,
      message: helpful
        ? "Marked as useful."
        : "Marked as not useful.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to save feedback.",
    };
  }
}

export async function promoteAiInteractionToKnowledgeAction(
  _prevState: AiKnowledgeActionState,
  formData: FormData
): Promise<AiKnowledgeActionState> {
  try {
    const interactionId = String(formData.get("interactionId") ?? "").trim();
    const titleInput = String(formData.get("title") ?? "").trim();
    const tagInput = String(formData.get("tags") ?? "").trim();
    if (!interactionId) {
      return {
        ok: false,
        message: "Missing interaction reference.",
      };
    }

    const interaction = await getAiInteraction(interactionId);
    if (!interaction) {
      return {
        ok: false,
        message: "Interaction not found.",
      };
    }

    const settings = await getAppSettings();
    const title =
      titleInput || `Learned ${interaction.tool.replace(/_/g, " ")} note`;
    const tags = [
      interaction.tool,
      "learned",
      ...tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ];
    await createAiKnowledgeDocument({
      title,
      content: [
        `Request: ${interaction.requestText}`,
        `Response: ${interaction.responseText}`,
        interaction.feedbackNotes ? `Feedback: ${interaction.feedbackNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      sourceType: "learned",
      sourceRef: interaction.id,
      tags,
      active: true,
    });
    await updateAiInteraction(interaction.id, {
      helpful: true,
      promotedToKnowledge: true,
      feedbackNotes:
        interaction.feedbackNotes ||
        (settings.ai.selfLearningEnabled
          ? "Promoted through self-learning loop."
          : undefined),
    });

    await recordAuditEvent({
      entityType: "system",
      entityId: "ai_knowledge",
      action: "ai_interaction_promoted_to_knowledge",
      summary: `AI interaction promoted to knowledge: ${title}`,
      actor: "Admin AI Studio",
      details: [`Interaction: ${interaction.id}`, `Tool: ${interaction.tool}`],
    });

    revalidatePath("/admin/ai");
    return {
      ok: true,
      message: "Saved to the knowledge base.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to promote interaction to knowledge.",
    };
  }
}
