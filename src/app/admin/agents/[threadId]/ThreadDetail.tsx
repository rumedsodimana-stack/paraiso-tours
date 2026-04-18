"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
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

  const statusBadge = isAwaitingApproval
    ? "bg-[#f3e8ce] text-[#7a5a17]"
    : thread.status === "completed"
      ? "bg-[#dce8dc] text-[#375a3f]"
      : thread.status === "rejected"
        ? "bg-[#eed9cf] text-[#7c3a24]"
        : "bg-[#e2e3dd] text-[#545a54]";

  const iconBg = isAwaitingApproval
    ? "bg-[#f3e8ce]"
    : thread.status === "completed"
      ? "bg-[#dce8dc]"
      : thread.status === "rejected"
        ? "bg-[#eed9cf]"
        : "bg-[#eef4f4]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="paraiso-card rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
            <Bot className="h-5 w-5 text-[#12343b]" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#11272b]">Booking Processor</h1>
            <p className="mt-1 text-sm text-[#5e7279] whitespace-pre-wrap">{thread.summary}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge}`}>
                {thread.status.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-[#8a9ba1]">{new Date(thread.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis & Availability */}
      {analysisTasks.map((task) => (
        <div key={task.id} className="paraiso-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            {task.taskType === "analysis"
              ? <Search className="h-4 w-4 text-[#12343b]" />
              : <AlertCircle className="h-4 w-4 text-[#c9922f]" />}
            <h2 className="text-sm font-semibold text-[#11272b]">{task.title}</h2>
          </div>
          <p className="text-sm text-[#5e7279] whitespace-pre-wrap leading-relaxed">{task.description}</p>
        </div>
      ))}

      {/* Guest Email */}
      {guestEmail && (() => {
        const action = guestEmail.proposedAction as Record<string, unknown>;
        return (
          <div className="rounded-2xl border border-[#d6e2e5] bg-[#eef4f4] p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-[#12343b]" />
              <h2 className="text-sm font-semibold text-[#11272b]">Guest Confirmation Email</h2>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${guestEmail.status === "pending" ? "bg-[#f3e8ce] text-[#7a5a17]" : "bg-[#dce8dc] text-[#375a3f]"}`}>
                {guestEmail.status}
              </span>
            </div>
            <div className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-4">
              <p className="text-xs text-[#8a9ba1]">To: <span className="font-medium text-[#5e7279]">{String(action.to)}</span></p>
              <p className="text-xs text-[#8a9ba1] mt-1">Subject: <span className="font-medium text-[#5e7279]">{String(action.subject)}</span></p>
              <div className="mt-3 border-t border-[#e0e4dd] pt-3">
                <p className="text-sm text-[#5e7279] whitespace-pre-wrap leading-relaxed">{String(action.body)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Supplier Emails */}
      {supplierEmailTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8a9ba1]">
            Supplier Reservation Emails ({supplierEmailTasks.length})
          </h2>
          {supplierEmailTasks.map((task) => {
            const action = task.proposedAction as Record<string, unknown>;
            const isHotel = task.title.toLowerCase().includes("hotel");
            return (
              <div key={task.id} className={`rounded-2xl border p-5 ${isHotel ? "border-[#dce8dc] bg-[#dce8dc]/30" : "border-[#e2e3dd] bg-[#e2e3dd]/30"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {isHotel
                    ? <BedDouble className="h-4 w-4 text-[#375a3f]" />
                    : <CarFront className="h-4 w-4 text-[#545a54]" />}
                  <h3 className="text-sm font-semibold text-[#11272b]">{task.title}</h3>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${task.status === "pending" ? "bg-[#f3e8ce] text-[#7a5a17]" : "bg-[#dce8dc] text-[#375a3f]"}`}>
                    {task.status}
                  </span>
                </div>
                <div className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-4">
                  <p className="text-xs text-[#8a9ba1]">To: <span className="font-medium text-[#5e7279]">{String(action.supplierEmail || action.to)}</span></p>
                  <p className="text-xs text-[#8a9ba1] mt-1">Subject: <span className="font-medium text-[#5e7279]">{String(action.subject)}</span></p>
                  <div className="mt-3 border-t border-[#e0e4dd] pt-3">
                    <p className="text-sm text-[#5e7279] whitespace-pre-wrap leading-relaxed">{String(action.body)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval */}
      {isAwaitingApproval && firstPendingId && (
        <div className="rounded-2xl border-2 border-[#f3e8ce] bg-[#f9f2e3] p-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-[#c9922f]" />
            <h3 className="text-lg font-bold text-[#11272b]">Your Decision Required</h3>
          </div>
          <p className="text-sm text-[#5e7279] mb-3">On approval:</p>
          <ul className="text-sm text-[#5e7279] space-y-1 mb-4 ml-4 list-disc">
            <li>Tour scheduled in the calendar</li>
            <li>{supplierEmailTasks.length} reservation email{supplierEmailTasks.length !== 1 ? "s" : ""} sent to suppliers</li>
            <li>Confirmation email sent to the guest</li>
          </ul>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm text-[#11272b] outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/20"
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-6 py-3 text-sm font-bold text-[#f6ead6] hover:bg-[#0f2b31] disabled:opacity-60"
            >
              <CheckCircle2 className="h-5 w-5" /> {loading ? "Processing..." : "Approve & Send All"}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eed9cf] bg-[#fffbf4] px-6 py-3 text-sm font-bold text-[#7c3a24] hover:bg-[#eed9cf] disabled:opacity-60"
            >
              <XCircle className="h-5 w-5" /> Reject
            </button>
          </div>
        </div>
      )}

      {thread.status === "completed" && (
        <div className="paraiso-card rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-[#375a3f]" />
          <div>
            <p className="font-semibold text-[#375a3f]">Approved &amp; Processed</p>
            <p className="text-sm text-[#5e7279]">Tour scheduled. All emails sent to suppliers and guest.</p>
          </div>
        </div>
      )}
      {thread.status === "rejected" && (
        <div className="rounded-2xl border border-[#eed9cf] bg-[#eed9cf]/30 p-5 flex items-center gap-3">
          <XCircle className="h-6 w-6 text-[#7c3a24]" />
          <div>
            <p className="font-semibold text-[#7c3a24]">Rejected</p>
            <p className="text-sm text-[#5e7279]">{thread.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
