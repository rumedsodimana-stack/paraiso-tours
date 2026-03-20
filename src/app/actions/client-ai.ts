"use server";

import { generateAiJsonResult, maybeRaiseAiBudgetAlert } from "@/lib/ai";
import { buildFocusTerms, buildSriLankaKnowledgeContext } from "@/lib/ai-knowledge";
import { buildClientConciergePrompts } from "@/lib/ai-prompts";
import { coerceClientJourneyPlan, type ClientJourneyPlan } from "@/lib/client-ai-concierge";
import {
  getCustomJourneyMealOptions,
  getCustomJourneyTransportOptions,
} from "@/lib/custom-journey";
import { createAiInteraction, getHotels, getPackagesForClient } from "@/lib/db";
import {
  getPlannerDestinations,
  getPlannerHotelsForDestination,
} from "@/lib/route-planner";

interface ClientJourneyConciergeInput {
  prompt: string;
  travelDate?: string;
  pax?: number;
  routeStops?: Array<{
    destinationId: string;
    nights: number;
    hotelId?: string;
  }>;
  accommodationMode?: "auto" | "choose";
  transportSelectionId?: string;
  mealSelectionId?: string;
  mealRequest?: string;
}

export interface ClientJourneyConciergeResult {
  ok: boolean;
  message: string;
  plan?: ClientJourneyPlan;
  interactionId?: string;
}

function formatCurrentState(input: ClientJourneyConciergeInput) {
  const route =
    input.routeStops && input.routeStops.length > 0
      ? input.routeStops
          .map(
            (stop, index) =>
              `${index + 1}. ${stop.destinationId} for ${stop.nights} night${
                stop.nights === 1 ? "" : "s"
              }${stop.hotelId ? ` (hotel ${stop.hotelId})` : ""}`
          )
          .join("\n")
      : "No route selected yet.";

  return [
    `Travel date: ${input.travelDate || "Not selected yet"}`,
    `Guest count: ${Math.max(1, input.pax ?? 2)}`,
    `Accommodation mode: ${input.accommodationMode ?? "auto"}`,
    `Transport: ${input.transportSelectionId || "none"}`,
    `Meals: ${input.mealSelectionId || "none"}`,
    `Meal notes: ${input.mealRequest?.trim() || "None"}`,
    "Current route:",
    route,
  ].join("\n");
}

function formatDestinationOptions() {
  return getPlannerDestinations()
    .filter((destination) => destination.id !== "airport")
    .map(
      (destination) =>
        `- ${destination.id}: ${destination.name} | ${destination.region} | stay ${destination.recommendedNights.min}-${destination.recommendedNights.max} nights | next ${destination.next.join(", ")}`
    )
    .join("\n");
}

function formatChoiceOptions(input: {
  transportOptions: Array<{
    id: string;
    label: string;
    price: number;
    currency: string;
    description: string;
    capacity?: number;
  }>;
  mealOptions: Array<{
    id: string;
    label: string;
    price: number;
    currency: string;
    description: string;
  }>;
}) {
  const transport = [
    "- none: No transport required",
    ...input.transportOptions.map(
      (option) =>
        `- ${option.id}: ${option.label} | ${option.description} | ${option.price} ${option.currency}${
          option.capacity ? ` | capacity ${option.capacity}` : ""
        }`
    ),
  ].join("\n");

  const meals = [
    "- none: No meal plan",
    ...input.mealOptions.map(
      (option) =>
        `- ${option.id}: ${option.label} | ${option.description} | ${option.price} ${option.currency}`
    ),
  ].join("\n");

  return [
    "Transport IDs:",
    transport,
    "",
    "Meal IDs:",
    meals,
  ].join("\n");
}

function formatHotelOptions(input: {
  hotelIdsByDestination: Record<string, string[]>;
  hotelLabelsById: Record<string, string>;
}) {
  return Object.entries(input.hotelIdsByDestination)
    .map(([destinationId, hotelIds]) => {
      const hotels =
        hotelIds.length > 0
          ? hotelIds
              .map((hotelId) => input.hotelLabelsById[hotelId] || hotelId)
              .join("; ")
          : "No mapped hotels";
      return `- ${destinationId}: ${hotels}`;
    })
    .join("\n");
}

export async function generateClientJourneyPlanAction(
  input: ClientJourneyConciergeInput
): Promise<ClientJourneyConciergeResult> {
  const prompt = input.prompt?.trim();
  if (!prompt) {
    return {
      ok: false,
      message: "Describe the trip you want first.",
    };
  }

  try {
    const [hotels, packages] = await Promise.all([
      getHotels(),
      getPackagesForClient(),
    ]);
    const estimateCurrency =
      packages[0]?.currency ?? hotels.find((hotel) => hotel.currency)?.currency ?? "USD";
    const transportOptions = getCustomJourneyTransportOptions(
      hotels,
      packages,
      estimateCurrency
    );
    const mealOptions = getCustomJourneyMealOptions(
      hotels,
      packages,
      estimateCurrency
    );

    const hotelIdsByDestination: Record<string, string[]> = {};
    const hotelLabelsById: Record<string, string> = {};

    for (const destination of getPlannerDestinations()) {
      if (destination.id === "airport") continue;
      const choices = getPlannerHotelsForDestination(destination.id, hotels, packages).slice(
        0,
        5
      );
      hotelIdsByDestination[destination.id] = choices.map((hotel) => hotel.id);
      for (const hotel of choices) {
        hotelLabelsById[hotel.id] =
          `${hotel.id}: ${hotel.name} (${hotel.pricePerNight} ${hotel.currency}/night)`;
      }
    }

    const knowledgeContext = buildSriLankaKnowledgeContext({
      query: prompt,
      focusTerms: buildFocusTerms({ query: prompt }),
      packages,
      hotels,
      travelDate: input.travelDate,
      pax: input.pax,
      maxDestinations: 8,
    });

    const prompts = buildClientConciergePrompts({
      request: prompt,
      currentState: formatCurrentState(input),
      optionContext: [
        "Destination IDs:",
        formatDestinationOptions(),
        "",
        formatChoiceOptions({
          transportOptions,
          mealOptions,
        }),
        "",
        "Hotel IDs by destination:",
        formatHotelOptions({
          hotelIdsByDestination,
          hotelLabelsById,
        }),
      ].join("\n"),
      knowledgeContext,
    });

    const { data: rawPlan, response } = await generateAiJsonResult<unknown>({
      feature: "client_concierge",
      title: prompts.title,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      usePromptCache: true,
    });

    const plan = coerceClientJourneyPlan(rawPlan, {
      defaultTravelDate: input.travelDate,
      defaultPax: input.pax,
      transportOptionIds: ["none", ...transportOptions.map((option) => option.id)],
      mealOptionIds: ["none", ...mealOptions.map((option) => option.id)],
      hotelIdsByDestination,
    });

    if (plan.routeStops.length === 0) {
      return {
        ok: false,
        message:
          "AI could not turn that brief into a valid route yet. Name at least one or two destinations or describe the travel style more clearly.",
      };
    }

    const routeSummary = plan.routeStops
      .map((stop) => stop.destinationId)
      .join(" -> ");
    const interaction = await createAiInteraction({
      tool: "client_concierge",
      requestText: prompt,
      responseText: JSON.stringify(plan),
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
    await maybeRaiseAiBudgetAlert();

    return {
      ok: true,
      message: `AI drafted the journey from ${routeSummary}. Review the summary, then edit any step you want.`,
      plan,
      interactionId: interaction.id,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "AI concierge could not draft the journey.",
    };
  }
}
