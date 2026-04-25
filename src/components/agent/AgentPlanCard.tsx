/**
 * Plan card — Cowork-grade multi-step trajectory visualization.
 *
 * Rendered inline in `<AgentConversation />` whenever the store has a
 * `currentPlan`. The agent publishes the plan via the `set_plan` tool
 * and flips step statuses via `update_plan_step`; this component is
 * pure presentation that subscribes to those updates through the
 * Zustand store.
 *
 * Visual hierarchy mirrors the rest of the conversation surface:
 *   - Soft cream / amber background to distinguish from chat bubbles
 *   - Small uppercase eyebrow (PLAN) so the role reads at a glance
 *   - One row per step with a status icon + title + optional note
 *   - Done counter in the header so the admin can see progress without
 *     reading every row
 *
 * Lifecycle: the card stays mounted as long as `currentPlan` is set.
 * It updates in place when steps flip status — no message-stream
 * duplication, no reflow per turn.
 */

"use client";

import {
  CheckCircle2,
  Circle,
  ListChecks,
  Loader2,
  MinusCircle,
} from "lucide-react";
import {
  useAgent,
  type Plan,
  type PlanStep,
} from "@/stores/ai-agent.store";

export function AgentPlanCard() {
  const plan = useAgent((s) => s.currentPlan);
  if (!plan) return null;
  return <PlanCardBody plan={plan} />;
}

function PlanCardBody({ plan }: { plan: Plan }) {
  const total = plan.steps.length;
  const done = plan.steps.filter(
    (s) => s.status === "done" || s.status === "skipped"
  ).length;

  return (
    <section
      aria-label={`Plan: ${plan.title}`}
      className="rounded-2xl border border-[#e0d4bc] bg-[#faf6ef] px-4 py-3 shadow-sm"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#7a5a17] text-[#f6ead6]">
            <ListChecks className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a5a17]">
              Plan
            </p>
            <p className="truncate text-sm font-semibold text-[#11272b]">
              {plan.title}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#f3e8ce] px-2 py-0.5 text-[11px] font-semibold text-[#7a5a17]">
          {done} / {total}
        </span>
      </header>

      <ol className="mt-3 space-y-2">
        {plan.steps.map((step, i) => (
          <PlanStepItem key={step.id} step={step} index={i + 1} />
        ))}
      </ol>
    </section>
  );
}

function PlanStepItem({
  step,
  index,
}: {
  step: PlanStep;
  index: number;
}) {
  const icon = (() => {
    if (step.status === "done")
      return <CheckCircle2 className="h-4 w-4 text-[#375a3f]" />;
    if (step.status === "in_progress")
      return <Loader2 className="h-4 w-4 animate-spin text-[#12343b]" />;
    if (step.status === "skipped")
      return <MinusCircle className="h-4 w-4 text-[#8a9ba1]" />;
    return <Circle className="h-4 w-4 text-[#c5cdd0]" />;
  })();

  const titleClass =
    step.status === "done" || step.status === "skipped"
      ? "text-[#8a9ba1] line-through"
      : step.status === "in_progress"
        ? "text-[#11272b] font-medium"
        : "text-[#5e7279]";

  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 w-4 shrink-0 text-center text-[10px] font-semibold text-[#c5cdd0] tabular-nums">
        {index}
      </span>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-5 ${titleClass}`}>{step.title}</p>
        {step.note && (
          <p className="mt-0.5 text-[11px] text-[#8a9ba1]">{step.note}</p>
        )}
      </div>
    </li>
  );
}
