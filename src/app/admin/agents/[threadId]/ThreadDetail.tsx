"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Mail,
  Search,
  BedDouble,
  CarFront,
  User,
} from "lucide-react";
import { approveAgentTaskAction, rejectAgentTaskAction } from "@/app/actions/agents";
import type { AgentThread, AgentTask } from "@/lib/agents/types";

export function ThreadDetail({ thread, tasks }: { thread: AgentThread; tasks: AgentTask[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isAwaitingApproval = thread.status === "awaiting_approval";
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const firstPendingId = pendingTasks[0]?.id;

  const analysisTasks = tasks.filter((t) => t.taskType === "analysis" || t.taskType === "availability_check");
  const emailTasks = tasks.filter((t) => t.taskType === "draft_email");
  const guestEmail = emailTasks.find((t) => {
    const a = t.proposedAction as Record<string, unknown> | undefined;
    return a?.type === "guest_email";
  });
  const supplierEmailTasks = emailTasks.filter((t) => {
    const a = t.proposedAction as Record<string, unknown> | undefined;
    return a?.type === "supplier_email";
  });

  async function handleApprove() {
    if (!firstPendingId) return;
    setLoading(true);
    await approveAgentTaskAction(thread.id, firstPendingId);
    router.refresh();
    setLoading(false);
  }

  async function handleReject() {
    if (!firstPendingId) return;
    setLoading(true);
    await rejectAgentTaskAction(thread.id, firstPendingId, rejectReason || undefined);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#ddc8b0] bg-white/74 p-6">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isAwaitingApproval ? "bg-amber-100" : thread.status === "completed" ? "bg-green-100" : thread.status === "rejected" ? "bg-red-100" : "bg-stone-100"
          }`}>
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-stone-900">Booking Processor</h1>
            <p className="mt-1 text-sm text-stone-600 whitespace-pre-wrap">{thread.summary}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                isAwaitingApproval ? "bg-amber-100 text-amber-700" : thread.status === "completed" ? "bg-green-100 text-green-700" : thread.status === "rejected" ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-700"
              }`}>
                {thread.status.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-stone-400">{new Date(thread.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis & Availability */}
      {analysisTasks.map((task) => (
        <div key={task.id} className="rounded-2xl border border-[#ddc8b0] bg-white/74 p-5">
          <div className="flex items-center gap-2 mb-3">
            {task.taskType === "analysis" ? <Search className="h-4 w-4 text-[#12343b]" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
            <h2 className="text-sm font-semibold text-stone-900">{task.title}</h2>
          </div>
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{task.description}</p>
        </div>
      ))}

      {/* Guest Email */}
      {guestEmail && (() => {
        const action = guestEmail.proposedAction as Record<string, unknown>;
        return (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-stone-900">Guest Confirmation Email</h2>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${guestEmail.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{guestEmail.status}</span>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white p-4">
              <p className="text-xs text-stone-500">To: <span className="font-medium text-stone-700">{String(action.to)}</span></p>
              <p className="text-xs text-stone-500 mt-1">Subject: <span className="font-medium text-stone-700">{String(action.subject)}</span></p>
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{String(action.body)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Supplier Emails */}
      {supplierEmailTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
            Supplier Reservation Emails ({supplierEmailTasks.length})
          </h2>
          {supplierEmailTasks.map((task) => {
            const action = task.proposedAction as Record<string, unknown>;
            const isHotel = task.title.toLowerCase().includes("hotel");
            return (
              <div key={task.id} className={`rounded-2xl border p-5 ${isHotel ? "border-teal-200 bg-teal-50/50" : "border-purple-200 bg-purple-50/50"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {isHotel ? <BedDouble className="h-4 w-4 text-teal-600" /> : <CarFront className="h-4 w-4 text-purple-600" />}
                  <h3 className="text-sm font-semibold text-stone-900">{task.title}</h3>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${task.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{task.status}</span>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="text-xs text-stone-500">To: <span className="font-medium text-stone-700">{String(action.supplierEmail || action.to)}</span></p>
                  <p className="text-xs text-stone-500 mt-1">Subject: <span className="font-medium text-stone-700">{String(action.subject)}</span></p>
                  <div className="mt-3 border-t border-stone-100 pt-3">
                    <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{String(action.body)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval */}
      {isAwaitingApproval && firstPendingId && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-bold text-stone-900">Your Decision Required</h3>
          </div>
          <p className="text-sm text-stone-600 mb-3">On approval:</p>
          <ul className="text-sm text-stone-600 space-y-1 mb-4 ml-4 list-disc">
            <li>Tour scheduled in the calendar</li>
            <li>{supplierEmailTasks.length} reservation email{supplierEmailTasks.length !== 1 ? "s" : ""} sent to suppliers</li>
            <li>Confirmation email sent to the guest</li>
          </ul>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Notes (optional)" rows={2}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm outline-none focus:border-teal-400" />
          <div className="mt-4 flex gap-3">
            <button onClick={handleApprove} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-6 py-3 text-sm font-bold text-white hover:bg-[#0f2b31] disabled:opacity-60">
              <CheckCircle2 className="h-5 w-5" /> {loading ? "Processing..." : "Approve & Send All"}
            </button>
            <button onClick={handleReject} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">
              <XCircle className="h-5 w-5" /> Reject
            </button>
          </div>
        </div>
      )}

      {thread.status === "completed" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <div>
            <p className="font-semibold text-green-800">Approved & Processed</p>
            <p className="text-sm text-green-700">Tour scheduled. All emails sent to suppliers and guest.</p>
          </div>
        </div>
      )}
      {thread.status === "rejected" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
          <XCircle className="h-6 w-6 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">Rejected</p>
            <p className="text-sm text-red-700">{thread.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
