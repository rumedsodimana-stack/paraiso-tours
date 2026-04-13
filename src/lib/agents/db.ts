import { supabase } from "../supabase";
import type { AgentThread, AgentTask } from "./types";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function toAgentThread(row: Record<string, unknown>): AgentThread {
  return {
    id: String(row.id),
    agentType: row.agent_type as AgentThread["agentType"],
    triggerEntityType: (row.trigger_entity_type as string | null) ?? undefined,
    triggerEntityId: (row.trigger_entity_id as string | null) ?? undefined,
    status: row.status as AgentThread["status"],
    currentNode: (row.current_node as string | null) ?? undefined,
    summary: (row.summary as string | null) ?? undefined,
    result: (row.result as Record<string, unknown>) ?? {},
    approvedBy: (row.approved_by as string | null) ?? undefined,
    approvedAt: (row.approved_at as string | null) ?? undefined,
    errorMessage: (row.error_message as string | null) ?? undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function toAgentTask(row: Record<string, unknown>): AgentTask {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    nodeName: String(row.node_name),
    taskType: row.task_type as AgentTask["taskType"],
    title: String(row.title),
    description: (row.description as string | null) ?? undefined,
    proposedAction: (row.proposed_action as Record<string, unknown> | null) ?? undefined,
    output: (row.output as Record<string, unknown> | null) ?? undefined,
    status: row.status as AgentTask["status"],
    adminNotes: (row.admin_notes as string | null) ?? undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

// ---------------------------------------------------------------------------
// Agent Threads
// ---------------------------------------------------------------------------

export async function createAgentThread(
  data: Omit<AgentThread, "createdAt" | "updatedAt" | "result"> & { result?: Record<string, unknown> }
): Promise<AgentThread> {
  const now = new Date().toISOString();
  const row = {
    id: data.id ?? generateId("thr"),
    agent_type: data.agentType,
    trigger_entity_type: toNullable(data.triggerEntityType),
    trigger_entity_id: toNullable(data.triggerEntityId),
    status: data.status,
    current_node: toNullable(data.currentNode),
    summary: toNullable(data.summary),
    result: data.result ?? {},
    approved_by: toNullable(data.approvedBy),
    approved_at: toNullable(data.approvedAt),
    error_message: toNullable(data.errorMessage),
    created_at: now,
    updated_at: now,
  };
  const { data: inserted, error } = await supabase!
    .from("agent_threads")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toAgentThread(inserted);
}

export async function updateAgentThread(
  id: string,
  patch: Partial<Omit<AgentThread, "id" | "createdAt">>
): Promise<AgentThread | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.agentType !== undefined) update.agent_type = patch.agentType;
  if (patch.triggerEntityType !== undefined) update.trigger_entity_type = toNullable(patch.triggerEntityType);
  if (patch.triggerEntityId !== undefined) update.trigger_entity_id = toNullable(patch.triggerEntityId);
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.currentNode !== undefined) update.current_node = toNullable(patch.currentNode);
  if (patch.summary !== undefined) update.summary = toNullable(patch.summary);
  if (patch.result !== undefined) update.result = patch.result;
  if (patch.approvedBy !== undefined) update.approved_by = toNullable(patch.approvedBy);
  if (patch.approvedAt !== undefined) update.approved_at = toNullable(patch.approvedAt);
  if (patch.errorMessage !== undefined) update.error_message = toNullable(patch.errorMessage);

  const { data: updated, error } = await supabase!
    .from("agent_threads")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return updated ? toAgentThread(updated) : null;
}

export async function getAgentThread(id: string): Promise<AgentThread | null> {
  const { data, error } = await supabase!
    .from("agent_threads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? toAgentThread(data) : null;
}

export async function getAgentThreads(status?: AgentThread["status"]): Promise<AgentThread[]> {
  let query = supabase!
    .from("agent_threads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (status) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toAgentThread(row));
}

export async function getAgentThreadByEntity(
  entityType: string,
  entityId: string
): Promise<AgentThread | null> {
  const { data, error } = await supabase!
    .from("agent_threads")
    .select("*")
    .eq("trigger_entity_type", entityType)
    .eq("trigger_entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? toAgentThread(data) : null;
}

// ---------------------------------------------------------------------------
// Agent Tasks
// ---------------------------------------------------------------------------

export async function createAgentTask(
  data: Omit<AgentTask, "id" | "createdAt" | "status"> & { status?: AgentTask["status"] }
): Promise<AgentTask> {
  const row = {
    id: generateId("task"),
    thread_id: data.threadId,
    node_name: data.nodeName,
    task_type: data.taskType,
    title: data.title,
    description: toNullable(data.description),
    proposed_action: toNullable(data.proposedAction),
    output: toNullable(data.output),
    status: data.status ?? "pending",
    admin_notes: toNullable(data.adminNotes),
    created_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase!
    .from("agent_tasks")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toAgentTask(inserted);
}

export async function updateAgentTask(
  id: string,
  patch: Partial<Omit<AgentTask, "id" | "createdAt">>
): Promise<AgentTask | null> {
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.adminNotes !== undefined) update.admin_notes = toNullable(patch.adminNotes);
  if (patch.output !== undefined) update.output = toNullable(patch.output);
  if (patch.proposedAction !== undefined) update.proposed_action = toNullable(patch.proposedAction);

  const { data: updated, error } = await supabase!
    .from("agent_tasks")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return updated ? toAgentTask(updated) : null;
}

export async function getAgentTasks(threadId: string): Promise<AgentTask[]> {
  const { data, error } = await supabase!
    .from("agent_tasks")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toAgentTask(row));
}
