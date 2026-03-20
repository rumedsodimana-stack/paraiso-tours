import { getAppSettings } from "./app-config";
import {
  buildAppArchitectureKnowledgeContext,
  buildAppUsageKnowledgeContext,
  buildWorkspaceCopilotCapabilitiesContext,
} from "./ai-app-knowledge";
import { getAiInteractions, getAiKnowledgeDocuments } from "./db";

interface RagDocument {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  tags?: string[];
}

interface RagChunk {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  tags: string[];
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function dedupe<T>(items: T[]) {
  return Array.from(new Set(items));
}

function buildEmailSkillPlaybook() {
  return [
    "Email skill playbook:",
    "- Write clear, human emails for guests, suppliers, and finance follow-up.",
    "- Use accurate references, dates, traveler counts, package names, and payment status taken from the app.",
    "- For client emails, default tone is warm, calm, and practical rather than over-salesy.",
    "- For supplier emails, be concise and operational: reservation dates, pax, rooming or service need, and response expectation.",
    "- Payment reminder emails should be polite, factual, and include invoice number, amount, due context, and how to respond.",
    "- Avoid promising availability or policy exceptions unless the data confirms them.",
  ].join("\n");
}

function buildCustomerCarePlaybook() {
  return [
    "Customer care playbook:",
    "- First answer the guest's actual question, then state the next step if one is needed.",
    "- Use booking reference, travel date, package, hotel, transport, meal, invoice, and payment status from the system when relevant.",
    "- If data is missing or not confirmed, say so directly instead of inventing an answer.",
    "- Reschedule, cancellation, and complaint handling should stay calm, specific, and escalation-aware.",
    "- For itinerary questions, explain route flow, what is included, and any operational dependencies like supplier confirmation.",
  ].join("\n");
}

function buildSupplierCoordinationPlaybook() {
  return [
    "Supplier coordination playbook:",
    "- Supplier communication should confirm dates, pax, service type, booked option, and any missing details that block fulfillment.",
    "- Hotels, transport providers, and meal providers should be addressed with concise operational requests.",
    "- If supplier contact details are missing, create an internal todo rather than pretending the communication was sent.",
    "- Supplier cost and payment-sensitive language should align with the selected booking options and payables data.",
  ].join("\n");
}

async function getBuiltInRagDocuments(): Promise<RagDocument[]> {
  const settings = await getAppSettings();

  return [
    {
      id: "builtin_app_architecture",
      title: "App Architecture",
      content: buildAppArchitectureKnowledgeContext(),
      sourceType: "system",
      tags: ["architecture", "codebase", "system"],
    },
    {
      id: "builtin_app_usage",
      title: "App Usage Guide",
      content: buildAppUsageKnowledgeContext(),
      sourceType: "system",
      tags: ["usage", "user guide", "workflow"],
    },
    {
      id: "builtin_workspace_capabilities",
      title: "Workspace Copilot Capabilities",
      content: buildWorkspaceCopilotCapabilitiesContext(),
      sourceType: "system",
      tags: ["copilot", "actions", "operations"],
    },
    {
      id: "builtin_email_playbook",
      title: "Email Skill Playbook",
      content: buildEmailSkillPlaybook(),
      sourceType: "system",
      tags: ["email", "customer care", "supplier"],
    },
    {
      id: "builtin_customer_care_playbook",
      title: "Customer Care Playbook",
      content: buildCustomerCarePlaybook(),
      sourceType: "system",
      tags: ["customer care", "guest support"],
    },
    {
      id: "builtin_supplier_coordination_playbook",
      title: "Supplier Coordination Playbook",
      content: buildSupplierCoordinationPlaybook(),
      sourceType: "system",
      tags: ["supplier", "coordination", "operations"],
    },
    {
      id: "builtin_company_notes",
      title: "Company AI Notes",
      content:
        settings.ai.knowledgeNotes?.trim() ||
        "No additional company-specific AI notes have been saved yet.",
      sourceType: "system",
      tags: ["company", "preferences"],
    },
  ];
}

function chunkDocument(document: RagDocument): RagChunk[] {
  const paragraphs = document.content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: RagChunk[] = [];
  let buffer = "";
  let index = 0;

  for (const paragraph of paragraphs) {
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length <= 900) {
      buffer = next;
      continue;
    }

    if (buffer) {
      chunks.push({
        id: `${document.id}_${index++}`,
        title: document.title,
        content: buffer,
        sourceType: document.sourceType,
        tags: document.tags ?? [],
      });
    }
    buffer = paragraph;
  }

  if (buffer) {
    chunks.push({
      id: `${document.id}_${index}`,
      title: document.title,
      content: buffer,
      sourceType: document.sourceType,
      tags: document.tags ?? [],
    });
  }

  return chunks;
}

function scoreChunk(chunk: RagChunk, query: string, tagHints: string[]) {
  const queryTokens = tokenize(query);
  const contentTokens = tokenize(`${chunk.title} ${chunk.content}`);
  const tagTokens = tokenize((chunk.tags ?? []).join(" "));

  if (queryTokens.length === 0 && tagHints.length === 0) return 0;

  let score = 0;
  for (const token of queryTokens) {
    const contentHits = contentTokens.filter((entry) => entry === token).length;
    score += contentHits * 3;
    if (chunk.title.toLowerCase().includes(token)) score += 5;
  }

  for (const hint of tagHints) {
    const normalized = hint.toLowerCase();
    if (
      chunk.tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
      tagTokens.includes(normalized)
    ) {
      score += 4;
    }
  }

  return score;
}

export async function buildRagContext(input: {
  query: string;
  tagHints?: string[];
}) {
  const settings = await getAppSettings();
  if (!settings.ai.ragEnabled) return "";

  const [builtInDocs, storedDocs, interactions] = await Promise.all([
    getBuiltInRagDocuments(),
    getAiKnowledgeDocuments(),
    getAiInteractions(80),
  ]);

  const learnedDocs: RagDocument[] = settings.ai.selfLearningEnabled
    ? interactions
        .filter(
          (interaction) => interaction.helpful || interaction.promotedToKnowledge
        )
        .map((interaction) => ({
          id: `interaction_${interaction.id}`,
          title: `Learned ${interaction.tool} note`,
          content: [
            `Request: ${interaction.requestText}`,
            `Response: ${interaction.responseText}`,
            interaction.feedbackNotes
              ? `Feedback: ${interaction.feedbackNotes}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          sourceType: interaction.promotedToKnowledge
            ? "learned"
            : "interaction",
          tags: [interaction.tool, "learned"],
        }))
    : [];

  const allDocs = [
    ...builtInDocs,
    ...storedDocs.map((document) => ({
      id: document.id,
      title: document.title,
      content: document.content,
      sourceType: document.sourceType,
      tags: document.tags,
    })),
    ...learnedDocs,
  ];

  const chunks = allDocs.flatMap(chunkDocument);
  const scored = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, input.query, dedupe(input.tagHints ?? [])),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, settings.ai.ragMaxChunks);

  if (scored.length === 0) return "";

  return [
    "Retrieved knowledge:",
    ...scored.map(
      ({ chunk }) =>
        `- [${chunk.title} | ${chunk.sourceType}] ${chunk.content.replace(/\n+/g, " ")}`
    ),
  ].join("\n");
}
