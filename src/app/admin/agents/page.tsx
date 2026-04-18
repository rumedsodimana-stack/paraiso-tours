import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, XCircle, Bot, ArrowRight } from "lucide-react";
import { getAgentThreads } from "@/lib/agents/db";

export default async function AgentsPage() {
  const threads = await getAgentThreads();
  const awaiting = threads.filter((t) => t.status === "awaiting_approval");
  const completed = threads.filter((t) => t.status === "completed");
  const rejected = threads.filter((t) => t.status === "rejected");
  const running = threads.filter((t) => t.status === "running");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#11272b]">AI Agents</h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Automated booking processing with human-in-the-loop approval
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="paraiso-card rounded-2xl p-4">
          <Clock className="h-5 w-5 text-[#c9922f]" />
          <p className="mt-2 text-2xl font-bold text-[#11272b]">{awaiting.length}</p>
          <p className="text-xs text-[#5e7279]">Awaiting approval</p>
        </div>
        <div className="paraiso-card rounded-2xl p-4">
          <Bot className="h-5 w-5 text-[#12343b]" />
          <p className="mt-2 text-2xl font-bold text-[#11272b]">{running.length}</p>
          <p className="text-xs text-[#5e7279]">Running</p>
        </div>
        <div className="paraiso-card rounded-2xl p-4">
          <CheckCircle2 className="h-5 w-5 text-[#375a3f]" />
          <p className="mt-2 text-2xl font-bold text-[#11272b]">{completed.length}</p>
          <p className="text-xs text-[#5e7279]">Completed</p>
        </div>
        <div className="paraiso-card rounded-2xl p-4">
          <XCircle className="h-5 w-5 text-[#8a9ba1]" />
          <p className="mt-2 text-2xl font-bold text-[#11272b]">{rejected.length}</p>
          <p className="text-xs text-[#5e7279]">Rejected</p>
        </div>
      </div>

      {/* Approval Queue */}
      {awaiting.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[#11272b]">Needs Your Approval</h2>
          <div className="mt-3 space-y-3">
            {awaiting.map((thread) => (
              <Link
                key={thread.id}
                href={`/admin/agents/${thread.id}`}
                className="paraiso-card flex items-center gap-4 rounded-2xl p-4 transition hover:bg-[#f4ecdd]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e8ce]">
                  <AlertCircle className="h-5 w-5 text-[#c9922f]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#11272b]">
                    {thread.summary || "Booking processing"}
                  </p>
                  <p className="text-xs text-[#8a9ba1]">
                    {thread.agentType === "booking_processor"
                      ? "Booking Processor"
                      : "Assistant"}{" "}
                    · {new Date(thread.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#8a9ba1]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      <div>
        <h2 className="text-lg font-semibold text-[#11272b]">Recent Activity</h2>
        {threads.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] p-6 text-center text-sm text-[#8a9ba1]">
            No agent activity yet. Agents will appear here when bookings are processed
            automatically.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {threads.slice(0, 20).map((thread) => (
              <Link
                key={thread.id}
                href={`/admin/agents/${thread.id}`}
                className="paraiso-card flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-[#faf6ef]"
              >
                <span
                  className={`flex h-2 w-2 rounded-full ${
                    thread.status === "awaiting_approval"
                      ? "bg-[#c9922f]"
                      : thread.status === "completed"
                        ? "bg-[#375a3f]"
                        : thread.status === "running"
                          ? "bg-[#12343b]"
                          : thread.status === "failed"
                            ? "bg-[#7c3a24]"
                            : "bg-[#8a9ba1]"
                  }`}
                />
                <span className="flex-1 text-sm text-[#5e7279]">
                  {thread.summary || thread.agentType}
                </span>
                <span className="text-xs text-[#8a9ba1]">
                  {new Date(thread.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
