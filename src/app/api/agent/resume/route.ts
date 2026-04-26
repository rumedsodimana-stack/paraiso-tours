/**
 * SSE streaming endpoint for the post-approval resume path (Cowork
 * Phase C optional).
 *
 * The original turn paused on a delete tool_use. The client held the
 * `AgentTurnState` while the admin reviewed the confirmation card; on
 * Approve / Reject the client POSTs back here with that state plus the
 * decision, and the runtime resumes the conversation — yielding the
 * pending tool's result, then streaming any follow-up assistant text
 * exactly like a fresh turn.
 *
 * Why streaming the resume matters: the admin already waited to make
 * the decision. The longer the post-approval response takes to start
 * appearing, the more it feels like the system stalled. Streaming
 * gives the same live-typing UX the fresh turn enjoys.
 *
 * Wire format mirrors `/api/agent/turn` exactly (one
 * `data: {json}\n\n` per StreamEvent, terminator `data: [DONE]\n\n`).
 * The client uses the same SSE reader for both endpoints — only the
 * URL and request body differ.
 *
 * Auth: `requireAdmin()` runs before any tokens flow, so an
 * unauthenticated request gets 401 in the headers.
 */

import { requireAdmin } from "@/lib/admin-session";
import { recordAuditEvent } from "@/lib/audit";
import {
  streamAgentResume,
  type StreamEvent,
  type AgentTurnState,
} from "@/lib/agent-runtime";

// Streaming agent turns can run for several minutes if the model
// chains many follow-up tool calls after the resumed delete; lift
// Vercel's default 10s ceiling. The runtime's own 4-minute total
// turn cap is the real bound.
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RequestBody {
  state?: AgentTurnState;
  approved?: boolean;
  rejectionReason?: string;
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

  if (!body.state || !body.state.pendingToolUseId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing or invalid agent-turn state.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (typeof body.approved !== "boolean") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing 'approved' boolean.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const pendingToolName = body.state.pendingToolName;
  const approved = body.approved;
  const rejectionReason = body.rejectionReason;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let toolCount = 0;
      let finalKind: StreamEvent["kind"] | "unknown" = "unknown";

      try {
        for await (const event of streamAgentResume({
          state: body.state!,
          approved,
          rejectionReason,
        })) {
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

        // Audit the resume outcome on the same trail batch resumes
        // write to, so the audit log stays unified across paths.
        await recordAuditEvent({
          entityType: "system",
          entityId: "agent",
          action: approved
            ? "agent_native_stream_resume_approved"
            : "agent_native_stream_resume_rejected",
          summary: approved
            ? `Agent (native streaming) resume — admin approved ${pendingToolName}`
            : `Agent (native streaming) resume — admin rejected ${pendingToolName}`,
          details: [
            `Resume outcome: ${finalKind}`,
            `Tools executed after resume: ${toolCount}`,
          ],
          metadata: {
            channel: "agent_ui",
            feature: "agent_native_stream_resume",
            tool: pendingToolName,
            approved,
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
