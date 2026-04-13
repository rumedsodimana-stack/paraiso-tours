import { generateAiText, generateAiJsonResult } from "@/lib/ai";
import type { AiFeature } from "@/lib/ai";
import type { AiModelMode } from "@/lib/types";

export async function agentGenerateText(params: {
  feature: AiFeature;
  title: string;
  systemPrompt: string;
  userPrompt: string;
  modelMode?: AiModelMode;
}) {
  return generateAiText({
    feature: params.feature,
    title: params.title,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    modelMode: params.modelMode ?? "default",
    usePromptCache: true,
  });
}

export async function agentGenerateJson<T>(params: {
  feature: AiFeature;
  title: string;
  systemPrompt: string;
  userPrompt: string;
  modelMode?: AiModelMode;
}) {
  return generateAiJsonResult<T>({
    feature: params.feature,
    title: params.title,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    modelMode: params.modelMode ?? "default",
    usePromptCache: true,
  });
}
