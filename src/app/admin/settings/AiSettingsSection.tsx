"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  KeyRound,
  Loader2,
  Orbit,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { updateAiSettingsAction } from "@/app/actions/app-settings";
import type { AppSettings } from "@/lib/types";

const initialState = { ok: false, message: "" };

interface AiRuntimeSummary {
  enabled: boolean;
  configured: boolean;
  providerLabel: string;
  credentialSource: "environment" | "settings" | "missing";
  hasEnvironmentKey: boolean;
  hasStoredKey: boolean;
  storedKeyUpdatedAt?: string;
  missingReason?: string;
}

function InputField(props: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  placeholder?: string;
  step?: number | string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{props.label}</span>
      {props.hint && (
        <span className="ml-2 text-xs text-stone-400">{props.hint}</span>
      )}
      <input
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        step={props.step}
        autoComplete={props.autoComplete}
        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{props.label}</span>
      <select
        name={props.name}
        defaultValue={props.defaultValue}
        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField(props: {
  label: string;
  name: string;
  defaultChecked: boolean;
  description: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        name={props.name}
        defaultChecked={props.defaultChecked}
        className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
      />
      <span>
        <span className="block text-sm font-medium text-stone-900">
          {props.label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-stone-500">
          {props.description}
        </span>
      </span>
    </label>
  );
}

function formatSavedTime(value?: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function AiSettingsSection({
  settings,
  runtime,
}: {
  settings: AppSettings;
  runtime: AiRuntimeSummary;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updateAiSettingsAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  const isMissingKey = runtime.credentialSource === "missing";

  const credentialLabel =
    runtime.credentialSource === "environment"
      ? "Using environment key"
      : runtime.credentialSource === "settings"
        ? "Using saved settings key"
        : "No AI key configured";

  const credentialTone =
    runtime.credentialSource === "environment"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : runtime.credentialSource === "settings"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-800";

  const savedKeyUpdated = formatSavedTime(runtime.storedKeyUpdatedAt);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-stone-900">
            AI control center
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Shared runtime for admin AI and the client concierge.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-6 space-y-8">

        {/* ── Step 1 banner ─ shown when no API key is configured ── */}
        {isMissingKey && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">Step 1 — Paste your API key below</p>
              <p className="mt-1 text-sm leading-6">
                AI features won&apos;t work until a key is saved. Scroll down to
                the <strong>Credentials</strong> section and paste your Gemini
                (or compatible) key, then hit{" "}
                <strong>Save AI settings</strong>.{" "}
                <Link
                  href="/admin/user-guide#ai-setup"
                  className="font-medium underline underline-offset-2 hover:text-amber-700"
                >
                  Setup guide →
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — CREDENTIALS  (moved to top so it's easy to find)
        ══════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            <KeyRound className="h-4 w-4" />
            Credentials
            {isMissingKey && (
              <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Required
              </span>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            {/* Key input */}
            <div
              className={`space-y-4 rounded-2xl border p-5 ${
                isMissingKey
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-stone-200 bg-white/70"
              }`}
            >
              <div>
                <label className="block">
                  <span className="text-sm font-medium text-stone-700">
                    AI API key
                  </span>
                  <span className="ml-2 text-xs text-stone-400">
                    — encrypted when saved
                  </span>
                  <input
                    name="aiApiKey"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      runtime.hasStoredKey
                        ? "Stored securely. Enter a new key to replace it."
                        : "Paste your Gemini API key here…"
                    }
                    className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:ring-2 ${
                      isMissingKey
                        ? "border-amber-300 bg-white focus:border-teal-500 focus:ring-teal-500/20"
                        : "border-stone-200 bg-white focus:border-teal-500 focus:ring-teal-500/20"
                    }`}
                  />
                </label>
              </div>

              {runtime.hasStoredKey ? (
                <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <input
                    type="checkbox"
                    name="aiClearSavedApiKey"
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-900">
                      Clear saved settings key
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-stone-500">
                      Leave this off to keep the current saved key.
                    </span>
                  </span>
                </label>
              ) : null}

              <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
                Use{" "}
                <code className="rounded bg-stone-200 px-1 text-stone-700">
                  GEMINI_API_KEY
                </code>{" "}
                as an env variable, or save a fallback key here. Environment
                variable always wins.{" "}
                <Link
                  href="/admin/user-guide#ai-setup"
                  className="font-medium text-teal-700 hover:text-teal-800"
                >
                  Setup guide
                </Link>
              </div>
            </div>

            {/* Status panel */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${credentialTone}`}
                >
                  {credentialLabel}
                </span>
                {runtime.hasEnvironmentKey ? (
                  <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                    Env key detected
                  </span>
                ) : null}
                {runtime.hasStoredKey ? (
                  <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                    Saved fallback ready
                  </span>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
                <p>
                  Provider:{" "}
                  <span className="font-semibold text-stone-900">
                    {runtime.providerLabel}
                  </span>
                </p>
                {savedKeyUpdated ? (
                  <p>
                    Saved key last updated{" "}
                    <span className="font-medium text-stone-900">
                      {savedKeyUpdated}
                    </span>
                  </p>
                ) : null}
                {runtime.missingReason ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                    {runtime.missingReason}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — RUNTIME
        ══════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            <Orbit className="h-4 w-4" />
            Runtime
          </div>
          <ToggleField
            label="Enable AI features"
            name="aiEnabled"
            defaultChecked={settings.ai.enabled}
            description="Turns on the shared AI runtime for the admin studio, booking copilot, and client concierge."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Provider type"
              name="aiProviderKind"
              defaultValue={settings.ai.providerKind}
              options={[
                { value: "gemini", label: "Google Gemini API" },
                { value: "openai_compatible", label: "OpenAI-compatible" },
              ]}
            />
            <InputField
              label="Provider label"
              name="aiProviderLabel"
              defaultValue={settings.ai.providerLabel}
              placeholder="Google Gemini"
            />
            <InputField
              label="Base URL"
              name="aiBaseUrl"
              type="url"
              defaultValue={settings.ai.baseUrl}
              placeholder="https://generativelanguage.googleapis.com/v1beta"
            />
            <InputField
              label="Default model"
              name="aiModel"
              defaultValue={settings.ai.model}
              placeholder="gemini-2.5-flash"
            />
            <InputField
              label="Simple model"
              name="aiSimpleModel"
              defaultValue={settings.ai.simpleModel}
              placeholder="gemini-2.5-flash-lite"
              hint="lightweight tasks"
            />
            <InputField
              label="Default route model"
              name="aiDefaultModel"
              defaultValue={settings.ai.defaultModel}
              placeholder="gemini-2.5-flash"
            />
            <InputField
              label="Heavy model"
              name="aiHeavyModel"
              defaultValue={settings.ai.heavyModel}
              placeholder="gemini-2.5-pro"
              hint="complex reasoning"
            />
            <InputField
              label="Temperature"
              name="aiTemperature"
              type="number"
              step="0.1"
              defaultValue={settings.ai.temperature}
              placeholder="0.4"
              hint="0 = focused, 1 = creative"
            />
            <InputField
              label="Max tokens"
              name="aiMaxTokens"
              type="number"
              defaultValue={settings.ai.maxTokens}
              placeholder="900"
            />
            <InputField
              label="RAG max chunks"
              name="aiRagMaxChunks"
              type="number"
              defaultValue={settings.ai.ragMaxChunks}
              placeholder="6"
            />
            <SelectField
              label="Prompt cache TTL"
              name="aiPromptCacheTtl"
              defaultValue={settings.ai.promptCacheTtl}
              options={[
                { value: "5m", label: "5 minutes" },
                { value: "1h", label: "1 hour" },
              ]}
            />
            <InputField
              label="Daily budget alert (USD)"
              name="aiDailyBudgetAlertUsd"
              type="number"
              step="0.01"
              defaultValue={settings.ai.dailyBudgetAlertUsd}
              placeholder="2"
            />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — KNOWLEDGE & GUIDANCE
        ══════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            <ShieldCheck className="h-4 w-4" />
            Knowledge &amp; guidance
          </div>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              Global instructions
            </span>
            <textarea
              name="aiGlobalInstructions"
              defaultValue={settings.ai.globalInstructions}
              rows={4}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              placeholder="Use a practical travel-operations tone..."
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              Company knowledge notes
            </span>
            <textarea
              name="aiKnowledgeNotes"
              defaultValue={settings.ai.knowledgeNotes}
              rows={5}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              placeholder="Preferred hotel standards, route style, supplier preferences, family/couple guidance, upsell rules..."
            />
          </label>
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 4 — TOOLS
        ══════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            <Sparkles className="h-4 w-4" />
            Tools
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <ToggleField
              label="Booking brief"
              name="aiBookingBriefEnabled"
              defaultChecked={settings.ai.bookingBriefEnabled}
              description="Summarize a booking, risks, and next actions for the ops team."
            />
            <ToggleField
              label="Package writer"
              name="aiPackageWriterEnabled"
              defaultChecked={settings.ai.packageWriterEnabled}
              description="Generate clearer sales copy and highlight structure for packages."
            />
            <ToggleField
              label="Journey assistant"
              name="aiJourneyAssistantEnabled"
              defaultChecked={settings.ai.journeyAssistantEnabled}
              description="Draft route ideas and travel guidance from a guest brief."
            />
            <ToggleField
              label="AI coworker"
              name="aiWorkspaceCopilotEnabled"
              defaultChecked={settings.ai.workspaceCopilotEnabled}
              description="Answer questions about the app and execute supported admin operations from natural-language requests."
            />
            <ToggleField
              label="Client concierge"
              name="aiClientConciergeEnabled"
              defaultChecked={settings.ai.clientConciergeEnabled}
              description="Let guests describe the trip they want and have AI draft the journey builder route, stays, transport, meals, and summary."
            />
            <ToggleField
              label="RAG retrieval"
              name="aiRagEnabled"
              defaultChecked={settings.ai.ragEnabled}
              description="Retrieve relevant knowledge documents and learned notes before generating answers."
            />
            <ToggleField
              label="Prompt caching"
              name="aiPromptCacheEnabled"
              defaultChecked={settings.ai.promptCacheEnabled}
              description="Keep provider-specific caching available when supported."
            />
            <ToggleField
              label="Self-learning loop"
              name="aiSelfLearningEnabled"
              defaultChecked={settings.ai.selfLearningEnabled}
              description="Keep AI interaction memory and allow approved outputs to be promoted into the knowledge base."
            />
            <ToggleField
              label="Superpower mode available"
              name="aiSuperpowerEnabled"
              defaultChecked={settings.ai.superpowerEnabled}
              description="Allow the AI coworker to enter guarded app-building mode when you explicitly arm Superpower inside the chat."
            />
          </div>
        </section>

        {/* Status message */}
        {state.message ? (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              state.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-stone-500">
            Shared by AI Studio and concierge.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save AI settings"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
