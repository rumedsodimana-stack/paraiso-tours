export interface AgentThread {
  id: string;
  agentType: "booking_processor" | "admin_assistant";
  triggerEntityType?: string;
  triggerEntityId?: string;
  status: "running" | "awaiting_approval" | "approved" | "rejected" | "completed" | "failed";
  currentNode?: string;
  summary?: string;
  result: Record<string, unknown>;
  approvedBy?: string;
  approvedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTask {
  id: string;
  threadId: string;
  nodeName: string;
  taskType: "analysis" | "draft_email" | "price_check" | "availability_check" | "action_proposal";
  title: string;
  description?: string;
  proposedAction?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "executed" | "skipped";
  adminNotes?: string;
  createdAt: string;
}
