import "server-only";

import { recordAuditEvent } from "./audit";
import { getAppSettings, getStoredAiApiKeyRecord } from "./app-config";
import { createTodo, getAiInteractions, getTodos } from "./db";
import { decryptStoredSecret } from "./settings-secrets";
import type { AiModelMode, AiProviderKind } from "./types";

export type AiFeature =
  | "booking_brief"
  | "package_writer"
  | "journey_assistant"
  | "workspace_copilot"
  | "client_concierge";

export interface AiTextRequest {
  feature: AiFeature;
  title: string;
  systemPrompt: string;
  userPrompt: string;
  modelMode?: AiModelMode;
  usePromptCache?: boolean;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

export interface AiRuntimeStatus {
  enabled: boolean;
  configured: boolean;
  providerKind: AiProviderKind;
  providerLabel: string;
  baseUrl: string;
  model: string;
  simpleModel: string;
  defaultModel: string;
  heavyModel: string;
  promptCacheEnabled: boolean;
  promptCacheTtl: "5m" | "1h";
  dailyBudgetAlertUsd: number;
  superpowerEnabled: boolean;
  credentialSource: "environment" | "settings" | "missing";
  hasEnvironmentKey: boolean;
  hasStoredKey: boolean;
  storedKeyUpdatedAt?: string;
  missingReason?: string;
}

export interface AiTextResponse {
  text: string;
  providerLabel: string;
  model: string;
  modelMode: Exclude<AiModelMode, "auto">;
  usage?: AiUsage;
  estimatedCostUsd?: number;
}

function isFeatureEnabled(
  feature: AiFeature,
  settings: Awaited<ReturnType<typeof getAppSettings>>
) {
  switch (feature) {
    case "booking_brief":
      return settings.ai.bookingBriefEnabled;
    case "package_writer":
      return settings.ai.packageWriterEnabled;
    case "journey_assistant":
      return settings.ai.journeyAssistantEnabled;
    case "workspace_copilot":
      return settings.ai.workspaceCopilotEnabled;
    case "client_concierge":
      return settings.ai.clientConciergeEnabled;
    default:
      return false;
  }
}

async function resolveApiKey() {
  const environmentKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  const storedRecord = await getStoredAiApiKeyRecord();

  let storedKey = "";
  let storedKeyError: string | undefined;

  if (storedRecord.encryptedKey) {
    try {
      storedKey = decryptStoredSecret(storedRecord.encryptedKey);
    } catch (error) {
      storedKeyError =
        error instanceof Error ? error.message : "Saved AI API key could not be read.";
    }
  }

  const source: AiRuntimeStatus["credentialSource"] = environmentKey
    ? "environment"
    : storedKey
      ? "settings"
      : "missing";

  return {
    value: environmentKey || storedKey || "",
    source,
    hasEnvironmentKey: Boolean(environmentKey),
    hasStoredKey: Boolean(storedKey),
    storedKeyUpdatedAt: storedRecord.updatedAt,
    missingReason:
      !environmentKey && storedRecord.encryptedKey && !storedKey
        ? storedKeyError
        : undefined,
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveRuntimeBaseUrl(
  providerKind: AiProviderKind,
  baseUrl: string
): string {
  const trimmed = trimTrailingSlash(baseUrl);
  if (!trimmed) {
    return providerKind === "anthropic"
      ? "https://api.anthropic.com/v1"
      : providerKind === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta"
        : "https://api.openai.com/v1";
  }
  return trimmed;
}

function normalizeAnthropicMessagesUrl(baseUrl: string) {
  if (baseUrl.endsWith("/messages")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl}/messages`;
  return `${baseUrl}/v1/messages`;
}

function normalizeOpenAiCompletionsUrl(baseUrl: string) {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  return `${baseUrl}/chat/completions`;
}

function normalizeGeminiGenerateContentUrl(baseUrl: string, model: string) {
  if (baseUrl.includes(":generateContent")) return baseUrl;
  if (baseUrl.endsWith(`/models/${model}`)) {
    return `${baseUrl}:generateContent`;
  }
  if (baseUrl.endsWith("/models")) {
    return `${baseUrl}/${model}:generateContent`;
  }
  return `${baseUrl}/models/${model}:generateContent`;
}

function extractOpenAiResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown[] }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const firstChoice = choices[0] as {
    message?: { content?: unknown };
  };
  const content = firstChoice.message?.content;

  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const typedPart = part as { type?: string; text?: string };
        return typedPart.type === "text" ? typedPart.text ?? "" : "";
      })
      .join("")
      .trim();
  }

  return "";
}

function extractAnthropicResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown[] }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const typedPart = part as { type?: string; text?: string };
      return typedPart.type === "text" ? typedPart.text ?? "" : "";
    })
    .join("")
    .trim();
}

function extractGeminiResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";

  const firstCandidate = candidates[0] as {
    content?: { parts?: Array<{ text?: string }> };
  };
  const parts = firstCandidate.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (part && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function extractOpenAiUsage(payload: unknown): AiUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") return undefined;

  const inputTokens = Number(usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? 0);

  if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens)) {
    return undefined;
  }

  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
  };
}

function extractAnthropicUsage(payload: unknown): AiUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") return undefined;

  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);
  const cacheCreationInputTokens = Number(
    usage.cache_creation_input_tokens ?? 0
  );
  const cacheReadInputTokens = Number(usage.cache_read_input_tokens ?? 0);

  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    cacheCreationInputTokens: Number.isFinite(cacheCreationInputTokens)
      ? cacheCreationInputTokens
      : 0,
    cacheReadInputTokens: Number.isFinite(cacheReadInputTokens)
      ? cacheReadInputTokens
      : 0,
  };
}

function extractGeminiUsage(payload: unknown): AiUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as { usageMetadata?: Record<string, unknown> })
    .usageMetadata;
  if (!usage || typeof usage !== "object") return undefined;

  const inputTokens = Number(usage.promptTokenCount ?? 0);
  const outputTokens = Number(usage.candidatesTokenCount ?? 0);
  const cacheReadInputTokens = Number(usage.cachedContentTokenCount ?? 0);

  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    cacheReadInputTokens: Number.isFinite(cacheReadInputTokens)
      ? cacheReadInputTokens
      : 0,
  };
}

function resolveAnthropicPricing(model: string) {
  const normalized = model.toLowerCase();

  if (normalized.includes("haiku-4-5")) {
    return {
      input: 1,
      output: 5,
      cacheWrite5m: 1.25,
      cacheWrite1h: 2,
      cacheRead: 0.1,
    };
  }

  if (normalized.includes("sonnet-4-6") || normalized.includes("sonnet-4-5")) {
    return {
      input: 3,
      output: 15,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
      cacheRead: 0.3,
    };
  }

  if (normalized.includes("opus-4-6") || normalized.includes("opus-4-5")) {
    return {
      input: 5,
      output: 25,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      cacheRead: 0.5,
    };
  }

  return null;
}

function estimateAnthropicCost(
  model: string,
  usage: AiUsage | undefined,
  cacheTtl: "5m" | "1h"
) {
  if (!usage) return undefined;
  const pricing = resolveAnthropicPricing(model);
  if (!pricing) return undefined;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheWriteRate =
    cacheTtl === "1h" ? pricing.cacheWrite1h : pricing.cacheWrite5m;
  const cacheWriteCost =
    ((usage.cacheCreationInputTokens ?? 0) / 1_000_000) * cacheWriteRate;
  const cacheReadCost =
    ((usage.cacheReadInputTokens ?? 0) / 1_000_000) * pricing.cacheRead;

  return Number(
    (inputCost + outputCost + cacheWriteCost + cacheReadCost).toFixed(6)
  );
}

function resolveGeminiPricing(model: string) {
  const normalized = model.toLowerCase();

  if (normalized.includes("gemini-2.5-pro")) {
    return {
      input: 1.25,
      output: 10,
      cacheRead: 0.125,
    };
  }

  if (normalized.includes("gemini-2.5-flash-lite")) {
    return {
      input: 0.1,
      output: 0.4,
      cacheRead: 0.01,
    };
  }

  if (normalized.includes("gemini-2.5-flash")) {
    return {
      input: 0.3,
      output: 2.5,
      cacheRead: 0.03,
    };
  }

  if (normalized.includes("gemini-3.1-flash-lite")) {
    return {
      input: 0.25,
      output: 1.5,
      cacheRead: 0.025,
    };
  }

  if (normalized.includes("gemini-3-flash")) {
    return {
      input: 0.5,
      output: 3,
      cacheRead: 0.05,
    };
  }

  return null;
}

function estimateGeminiCost(model: string, usage: AiUsage | undefined) {
  if (!usage) return undefined;
  const pricing = resolveGeminiPricing(model);
  if (!pricing) return undefined;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost =
    ((usage.cacheReadInputTokens ?? 0) / 1_000_000) * pricing.cacheRead;

  return Number((inputCost + outputCost + cacheReadCost).toFixed(6));
}

function resolveModelMode(
  requestedMode: AiModelMode | undefined,
  feature: AiFeature
): Exclude<AiModelMode, "auto"> {
  if (requestedMode && requestedMode !== "auto") {
    return requestedMode;
  }

  if (feature === "client_concierge") {
    return "simple";
  }

  return "default";
}

function resolveModel(
  settings: Awaited<ReturnType<typeof getAppSettings>>,
  feature: AiFeature,
  requestedMode?: AiModelMode
) {
  const modelMode = resolveModelMode(requestedMode, feature);
  const model =
    modelMode === "simple"
      ? settings.ai.simpleModel
      : modelMode === "heavy"
        ? settings.ai.heavyModel
        : settings.ai.defaultModel || settings.ai.model;

  return {
    modelMode,
    model: model || settings.ai.model,
  };
}

export async function getAiRuntimeStatus(): Promise<AiRuntimeStatus> {
  const settings = await getAppSettings();
  const resolvedApiKey = await resolveApiKey();
  const baseUrl = resolveRuntimeBaseUrl(
    settings.ai.providerKind,
    settings.ai.baseUrl
  );

  if (!settings.ai.enabled) {
    return {
      enabled: false,
      configured: false,
      providerKind: settings.ai.providerKind,
      providerLabel: settings.ai.providerLabel,
      baseUrl,
      model: settings.ai.model,
      simpleModel: settings.ai.simpleModel,
      defaultModel: settings.ai.defaultModel,
      heavyModel: settings.ai.heavyModel,
      promptCacheEnabled: settings.ai.promptCacheEnabled,
      promptCacheTtl: settings.ai.promptCacheTtl,
      dailyBudgetAlertUsd: settings.ai.dailyBudgetAlertUsd,
      superpowerEnabled: settings.ai.superpowerEnabled,
      credentialSource: resolvedApiKey.source,
      hasEnvironmentKey: resolvedApiKey.hasEnvironmentKey,
      hasStoredKey: resolvedApiKey.hasStoredKey,
      storedKeyUpdatedAt: resolvedApiKey.storedKeyUpdatedAt,
      missingReason: "AI is disabled in admin settings.",
    };
  }

  if (!resolvedApiKey.value) {
    return {
      enabled: true,
      configured: false,
      providerKind: settings.ai.providerKind,
      providerLabel: settings.ai.providerLabel,
      baseUrl,
      model: settings.ai.model,
      simpleModel: settings.ai.simpleModel,
      defaultModel: settings.ai.defaultModel,
      heavyModel: settings.ai.heavyModel,
      promptCacheEnabled: settings.ai.promptCacheEnabled,
      promptCacheTtl: settings.ai.promptCacheTtl,
      dailyBudgetAlertUsd: settings.ai.dailyBudgetAlertUsd,
      superpowerEnabled: settings.ai.superpowerEnabled,
      credentialSource: resolvedApiKey.source,
      hasEnvironmentKey: resolvedApiKey.hasEnvironmentKey,
      hasStoredKey: resolvedApiKey.hasStoredKey,
      storedKeyUpdatedAt: resolvedApiKey.storedKeyUpdatedAt,
      missingReason:
        resolvedApiKey.missingReason ||
        "Missing AI API key. Add one in Admin Settings or env.",
    };
  }

  if (!baseUrl || !settings.ai.model) {
    return {
      enabled: true,
      configured: false,
      providerKind: settings.ai.providerKind,
      providerLabel: settings.ai.providerLabel,
      baseUrl,
      model: settings.ai.model,
      simpleModel: settings.ai.simpleModel,
      defaultModel: settings.ai.defaultModel,
      heavyModel: settings.ai.heavyModel,
      promptCacheEnabled: settings.ai.promptCacheEnabled,
      promptCacheTtl: settings.ai.promptCacheTtl,
      dailyBudgetAlertUsd: settings.ai.dailyBudgetAlertUsd,
      superpowerEnabled: settings.ai.superpowerEnabled,
      credentialSource: resolvedApiKey.source,
      hasEnvironmentKey: resolvedApiKey.hasEnvironmentKey,
      hasStoredKey: resolvedApiKey.hasStoredKey,
      storedKeyUpdatedAt: resolvedApiKey.storedKeyUpdatedAt,
      missingReason: "Base URL or model is missing in AI settings.",
    };
  }

  return {
    enabled: true,
    configured: true,
    providerKind: settings.ai.providerKind,
    providerLabel: settings.ai.providerLabel,
    baseUrl,
    model: settings.ai.model,
    simpleModel: settings.ai.simpleModel,
    defaultModel: settings.ai.defaultModel,
    heavyModel: settings.ai.heavyModel,
    promptCacheEnabled: settings.ai.promptCacheEnabled,
    promptCacheTtl: settings.ai.promptCacheTtl,
    dailyBudgetAlertUsd: settings.ai.dailyBudgetAlertUsd,
    superpowerEnabled: settings.ai.superpowerEnabled,
    credentialSource: resolvedApiKey.source,
    hasEnvironmentKey: resolvedApiKey.hasEnvironmentKey,
    hasStoredKey: resolvedApiKey.hasStoredKey,
    storedKeyUpdatedAt: resolvedApiKey.storedKeyUpdatedAt,
  };
}

async function requestAnthropicText(
  input: {
    apiKey: string;
    runtime: AiRuntimeStatus;
    settings: Awaited<ReturnType<typeof getAppSettings>>;
    request: AiTextRequest;
    model: string;
    modelMode: Exclude<AiModelMode, "auto">;
  }
): Promise<AiTextResponse> {
  const response = await fetch(normalizeAnthropicMessagesUrl(input.runtime.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.settings.ai.temperature,
      max_tokens: input.settings.ai.maxTokens,
      system: [
        input.settings.ai.globalInstructions?.trim(),
        input.request.systemPrompt,
      ]
        .filter(Boolean)
        .join("\n\n"),
      messages: [
        {
          role: "user",
          content: `Task: ${input.request.title}\n\n${input.request.userPrompt}`,
        },
      ],
      cache_control:
        input.settings.ai.promptCacheEnabled && input.request.usePromptCache
          ? {
              type: "ephemeral",
              ttl: input.settings.ai.promptCacheTtl,
            }
          : undefined,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `AI request failed (${response.status}). ${body || "No error body returned."}`
    );
  }

  const payload = (await response.json()) as unknown;
  const text = extractAnthropicResponseText(payload);
  if (!text) {
    throw new Error("AI response was empty.");
  }

  const usage = extractAnthropicUsage(payload);
  return {
    text,
    providerLabel: input.runtime.providerLabel,
    model: input.model,
    modelMode: input.modelMode,
    usage,
    estimatedCostUsd: estimateAnthropicCost(
      input.model,
      usage,
      input.settings.ai.promptCacheTtl
    ),
  };
}

async function requestGeminiText(
  input: {
    apiKey: string;
    runtime: AiRuntimeStatus;
    settings: Awaited<ReturnType<typeof getAppSettings>>;
    request: AiTextRequest;
    model: string;
    modelMode: Exclude<AiModelMode, "auto">;
  }
): Promise<AiTextResponse> {
  const response = await fetch(
    normalizeGeminiGenerateContentUrl(input.runtime.baseUrl, input.model),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: [
                input.settings.ai.globalInstructions?.trim(),
                input.request.systemPrompt,
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Task: ${input.request.title}\n\n${input.request.userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: input.settings.ai.temperature,
          maxOutputTokens: input.settings.ai.maxTokens,
        },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `AI request failed (${response.status}). ${body || "No error body returned."}`
    );
  }

  const payload = (await response.json()) as unknown;
  const text = extractGeminiResponseText(payload);
  if (!text) {
    throw new Error("AI response was empty.");
  }

  const usage = extractGeminiUsage(payload);
  return {
    text,
    providerLabel: input.runtime.providerLabel,
    model: input.model,
    modelMode: input.modelMode,
    usage,
    estimatedCostUsd: estimateGeminiCost(input.model, usage),
  };
}

async function requestOpenAiCompatibleText(
  input: {
    apiKey: string;
    runtime: AiRuntimeStatus;
    settings: Awaited<ReturnType<typeof getAppSettings>>;
    request: AiTextRequest;
    model: string;
    modelMode: Exclude<AiModelMode, "auto">;
  }
): Promise<AiTextResponse> {
  const response = await fetch(
    normalizeOpenAiCompletionsUrl(input.runtime.baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.settings.ai.temperature,
        max_tokens: input.settings.ai.maxTokens,
        messages: [
          {
            role: "system",
            content: [
              input.settings.ai.globalInstructions?.trim(),
              input.request.systemPrompt,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
          {
            role: "user",
            content: `Task: ${input.request.title}\n\n${input.request.userPrompt}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `AI request failed (${response.status}). ${body || "No error body returned."}`
    );
  }

  const payload = (await response.json()) as unknown;
  const text = extractOpenAiResponseText(payload);
  if (!text) {
    throw new Error("AI response was empty.");
  }

  return {
    text,
    providerLabel: input.runtime.providerLabel,
    model: input.model,
    modelMode: input.modelMode,
    usage: extractOpenAiUsage(payload),
  };
}

export async function generateAiText(request: AiTextRequest): Promise<AiTextResponse> {
  const settings = await getAppSettings();
  const runtime = await getAiRuntimeStatus();
  const apiKey = (await resolveApiKey()).value;

  if (!runtime.enabled) {
    throw new Error(runtime.missingReason || "AI is disabled.");
  }
  if (!runtime.configured) {
    throw new Error(runtime.missingReason || "AI is not configured.");
  }
  if (!isFeatureEnabled(request.feature, settings)) {
    throw new Error("This AI tool is disabled in settings.");
  }

  const { model, modelMode } = resolveModel(
    settings,
    request.feature,
    request.modelMode
  );

  if (runtime.providerKind === "anthropic") {
    return requestAnthropicText({
      apiKey,
      runtime,
      settings,
      request,
      model,
      modelMode,
    });
  }

  if (runtime.providerKind === "gemini") {
    return requestGeminiText({
      apiKey,
      runtime,
      settings,
      request,
      model,
      modelMode,
    });
  }

  return requestOpenAiCompatibleText({
    apiKey,
    runtime,
    settings,
    request,
    model,
    modelMode,
  });
}

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

export async function generateAiJsonResult<T>(
  request: AiTextRequest
): Promise<{ data: T; response: AiTextResponse }> {
  const response = await generateAiText(request);
  const jsonText = extractJsonBlock(response.text);

  try {
    return {
      data: JSON.parse(jsonText) as T,
      response,
    };
  } catch (error) {
    throw new Error(
      `AI returned invalid JSON. ${
        error instanceof Error ? error.message : "Unknown parse failure."
      }`
    );
  }
}

export async function generateAiJson<T>(request: AiTextRequest): Promise<T> {
  const result = await generateAiJsonResult<T>(request);
  return result.data;
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function maybeRaiseAiBudgetAlert() {
  const settings = await getAppSettings();
  if (!settings.ai.enabled || settings.ai.dailyBudgetAlertUsd <= 0) {
    return;
  }

  const [interactions, todos] = await Promise.all([
    getAiInteractions(1000),
    getTodos(),
  ]);
  const todayKey = getTodayDateKey();
  const todayInteractions = interactions.filter((interaction) =>
    interaction.createdAt.startsWith(todayKey)
  );
  const todaySpend = todayInteractions.reduce(
    (sum, interaction) => sum + (interaction.estimatedCostUsd ?? 0),
    0
  );

  if (todaySpend < settings.ai.dailyBudgetAlertUsd) {
    return;
  }

  const alertTitle = `AI spend alert ${todayKey}: estimated $${todaySpend.toFixed(
    2
  )} today`;
  const existing = todos.find((todo) => todo.title.startsWith(`AI spend alert ${todayKey}:`));
  if (existing) {
    return;
  }

  await createTodo({
    title: alertTitle,
    completed: false,
  });

  await recordAuditEvent({
    entityType: "system",
    entityId: "ai_spend",
    action: "ai_daily_budget_alert",
    summary: `AI estimated spend crossed $${settings.ai.dailyBudgetAlertUsd.toFixed(
      2
    )} for ${todayKey}`,
    actor: "AI runtime",
    details: [
      `Today's estimated spend: $${todaySpend.toFixed(2)}`,
      `Alert threshold: $${settings.ai.dailyBudgetAlertUsd.toFixed(2)}`,
      `Interaction count: ${todayInteractions.length}`,
    ],
  });
}
