/**
 * AsyncLocalStorage-based actor context for the audit log.
 *
 * Problem: when the AI agent calls a tool that wraps a server action
 * (e.g. `schedule_tour_from_lead` → `scheduleTourFromLeadAction`),
 * the audit events recorded inside that action default to
 * `actor: "Admin"` — making it impossible for admin to tell what
 * the AI did autonomously vs what they did themselves.
 *
 * Solution: carry the actor through the async call stack via
 * Node's AsyncLocalStorage. Tool wrappers call `runAsActor(...)`
 * to set the actor for the scope of their handler; the audit
 * recorder reads from the active context as the default. Falls
 * back to "Admin" when no context is set, preserving existing
 * behaviour for direct admin server-action calls.
 *
 * Usage:
 *   await runAsActor("AI Assistant", async () => {
 *     // any recordAuditEvent() inside here gets actor: "AI Assistant"
 *     await someServerAction();
 *   });
 *
 * This file is server-only by virtue of importing node:async_hooks.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface AuditActorFrame {
  actor: string;
}

const auditActorStorage = new AsyncLocalStorage<AuditActorFrame>();

/**
 * Run `fn` inside an audit-actor scope so any nested
 * recordAuditEvent calls default to the supplied actor instead of
 * "Admin". Nested scopes win — an inner runAsActor("Booking
 * Processor") inside an outer runAsActor("AI Assistant") would tag
 * its inner work as the booking processor.
 */
export async function runAsActor<T>(
  actor: string,
  fn: () => Promise<T>
): Promise<T> {
  return auditActorStorage.run({ actor }, fn);
}

/**
 * Read the current actor context, or null when none is set
 * (i.e. a direct admin call from a server action).
 */
export function getCurrentActor(): string | null {
  return auditActorStorage.getStore()?.actor ?? null;
}
