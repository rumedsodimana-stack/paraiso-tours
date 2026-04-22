"use server";

import { revalidatePath } from "next/cache";
import { Command } from "@langchain/langgraph";
import { compileBookingProcessor } from "@/lib/agents";
import {
  createAgentThread,
  updateAgentThread,
  getAgentThread,
  getAgentThreads,
  getAgentTasks,
  updateAgentTask,
} from "@/lib/agents/db";
import { recordAuditEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-session";

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function startBookingProcessorAction(leadId: string) {
  await requireAdmin();
  const threadId = generateId("thr");

  await createAgentThread({
    id: threadId,
    agentType: "booking_processor",
    triggerEntityType: "lead",
    triggerEntityId: leadId,
    status: "running",
    currentNode: "reviewBooking",
  });

  try {
    const graph = compileBookingProcessor();
    await graph.invoke(
      { threadId, leadId },
      { configurable: { thread_id: threadId } }
    );
  } catch (err) {
    // interrupt() throws — this is expected when the graph pauses for human approval
    // The graph state is saved by the checkpointer
    const thread = await getAgentThread(threadId);
    if (thread?.status !== "awaiting_approval") {
      await updateAgentThread(threadId, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath("/admin/agents");
  revalidatePath("/admin/bookings");
  return { threadId };
}

export async function approveAgentTaskAction(
  threadId: string,
  taskId: string,
  edits?: { emailBody?: string; notes?: string }
) {
  await requireAdmin();
  await updateAgentTask(taskId, { status: "approved", adminNotes: edits?.notes });

  try {
    const graph = compileBookingProcessor();
    await graph.invoke(
      new Command({ resume: { approved: true, notes: edits?.notes || "", editedEmailBody: edits?.emailBody } }),
      { configurable: { thread_id: threadId } },
    );
  } catch {
    // Graph completed or another interrupt
  }

  await recordAuditEvent({
    entityType: "agent",
    entityId: threadId,
    action: "approved",
    summary: `Agent task approved${edits?.notes ? `: ${edits.notes}` : ""}`,
    actor: "admin",
  });

  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${threadId}`);
  return { success: true };
}

export async function rejectAgentTaskAction(
  threadId: string,
  taskId: string,
  reason?: string
) {
  await requireAdmin();
  await updateAgentTask(taskId, { status: "rejected", adminNotes: reason });
  await updateAgentThread(threadId, {
    status: "rejected",
    summary: `Rejected${reason ? `: ${reason}` : ""}`,
  });

  try {
    const graph = compileBookingProcessor();
    await graph.invoke(
      new Command({ resume: { approved: false, notes: reason || "" } }),
      { configurable: { thread_id: threadId } },
    );
  } catch {
    // Graph completed
  }

  await recordAuditEvent({
    entityType: "agent",
    entityId: threadId,
    action: "rejected",
    summary: `Agent task rejected${reason ? `: ${reason}` : ""}`,
    actor: "admin",
  });

  revalidatePath("/admin/agents");
  return { success: true };
}

export async function getAgentDashboardAction() {
  await requireAdmin();
  const threads = await getAgentThreads();
  const awaitingApproval = threads.filter((t) => t.status === "awaiting_approval");
  const recent = threads.filter((t) => t.status !== "awaiting_approval").slice(0, 20);
  return { awaitingApproval, recent };
}

export async function getAgentThreadDetailAction(threadId: string) {
  await requireAdmin();
  const thread = await getAgentThread(threadId);
  if (!thread) return null;
  const tasks = await getAgentTasks(threadId);
  return { thread, tasks };
}
