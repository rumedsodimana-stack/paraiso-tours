/**
 * SSE streaming endpoint for the native-tool-calling agent runtime.
 *
 * Why an API route instead of a server action: Next.js server actions
 * return a single Promise. They cannot stream incremental tokens to
 * the client. To get Cowork-style live typing — where the model's text
 * appears character-by-character and tool calls show "calling X" the
 * moment they begin — we need a long-lived response stream.
 *
 * Wire format: Server-Sent Events (SSE). Each `StreamEvent` from
 * `streamAgentTurn` becomes one `data: {json}\n\n` chunk on the wire.
 * The terminal frame is `data: [DONE]\n\n`, after which the stream
 * closes. The client's fetch reader watches for this marker to know
 * the turn is over.
 *
 * Auth: `requireAdmin()` runs before any tokens flow, so an
 * unauthenticated request gets 401 in the headers, never any model
 * output.
 *
 * Resume stays on the legacy server action (`resumeAgentTurnAction`).
 * Approval-driven resumes are short and bursty; streaming them adds
 * complexity without UX win.
 */

import { requireAdmin } from "@/lib/admin-session";
import { recordAuditEvent } from "@/lib/audit";
import {
  streamAgentTurn,
  type StreamEvent,
  type RunAgentTurnInput,
} from "@/lib/agent-runtime";
import type { AgentObservation } from "@/lib/agent-ooda";

// Vercel function configuration. Streaming agent turns can run for
// several minutes if the model chains many tool calls; lift the
// default 10s ceiling. The runtime itself enforces a 4-minute total
// turn cap, so this is just the outer bound.
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RequestBody {
  request?: string;
  observation?: AgentObservation;
}

function sseFrame(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function sseDone(): Uint8Array {
  return new TextEncoder().encode("data: [DONE]\n\n");
}

export async function POST(req: Request): Promise<Response> {
  // Auth gate first — never start streaming for an unauthenticated caller.
  try {
    await requireAdmin();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const userMessage = body.request?.trim() ?? "";
  if (!userMessage) {
    return new Response(
      JSON.stringify({ ok: false, error: "Empty request — nothing to do." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!body.observation) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing observation." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build the streaming response. The ReadableStream's start callback
  // runs the async generator, encodes each event into an SSE frame, and
  // closes the stream on `complete`, `pending_approval`, or `error`.
  const input: RunAgentTurnInput = {
    userMessage,
    observation: body.observation,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let toolCount = 0;
      let finalKind: StreamEvent["kind"] | "unknown" = "unknown";

      try {
        for await (const event of streamAgentTurn(input)) {
          controller.enqueue(sseFrame(event));
          if (event.kind === "tool_result") toolCount += 1;
          if (
            event.kind === "complete" ||
            event.kind === "pending_approval" ||
            event.kind === "error"
          ) {
            finalKind = event.kind;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          sseFrame({ kind: "error", error: message } satisfies StreamEvent)
        );
        finalKind = "error";
      } finally {
        controller.enqueue(sseDone());
        controller.close();

        // Audit the turn outcome — same trail the batch action writes
        // to, so admin/settings audit log stays unified across both
        // paths.
        await recordAuditEvent({
          entityType: "system",
          entityId: "agent",
          action:
            finalKind === "complete"
              ? "agent_native_stream_complete"
              : finalKind === "pending_approval"
                ? "agent_native_stream_pending"
                : finalKind === "error"
                  ? "agent_native_stream_error"
                  : "agent_native_stream_unknown",
          summary: `Agent (native streaming) turn — ${finalKind}`,
          details: [
            `Request: ${userMessage.slice(0, 200)}${userMessage.length > 200 ? "…" : ""}`,
            `Tools executed: ${toolCount}`,
          ],
          metadata: {
            channel: "agent_ui",
            feature: "agent_native_stream",
            kind: finalKind,
          },
        }).catch(() => {
          // Audit failure must not crash the response — already closed.
        });
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable Vercel's response buffering so frames flush immediately
      // (per https://vercel.com/docs/functions/streaming).
      "X-Accel-Buffering": "no",
    },
  });
}
