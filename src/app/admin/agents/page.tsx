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
        <h1 className="text-3xl font-bold text-stone-900">AI Agents</h1>
        <p className="mt-1 text-sm text-stone-600">
          Automated booking processing with human-in-the-loop approval
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Clock className="h-5 w-5 text-amber-600" />
          <p className="mt-2 text-2xl font-bold text-stone-900">{awaiting.length}</p>
          <p className="text-xs text-stone-600">Awaiting approval</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <Bot className="h-5 w-5 text-blue-600" />
          <p className="mt-2 text-2xl font-bold text-stone-900">{running.length}</p>
          <p className="text-xs text-stone-600">Running</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="mt-2 text-2xl font-bold text-stone-900">{completed.length}</p>
          <p className="text-xs text-stone-600">Completed</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <XCircle className="h-5 w-5 text-stone-400" />
          <p className="mt-2 text-2xl font-bold text-stone-900">{rejected.length}</p>
          <p className="text-xs text-stone-600">Rejected</p>
        </div>
      </div>

      {/* Approval Queue */}
      {awaiting.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Needs Your Approval</h2>
          <div className="mt-3 space-y-3">
            {awaiting.map((thread) => (
              <Link
                key={thread.id}
                href={`/admin/agents/${thread.id}`}
                className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-white p-4 transition hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">
                    {thread.summary || "Booking processing"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {thread.agentType === "booking_processor"
                      ? "Booking Processor"
                      : "Assistant"}{" "}
                    · {new Date(thread.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-stone-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Recent Activity</h2>
        {threads.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
            No agent activity yet. Agents will appear here when bookings are processed
            automatically.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {threads.slice(0, 20).map((thread) => (
              <Link
                key={thread.id}
                href={`/admin/agents/${thread.id}`}
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:bg-stone-50"
              >
                <span
                  className={`flex h-2 w-2 rounded-full ${
                    thread.status === "awaiting_approval"
                      ? "bg-amber-500"
                      : thread.status === "completed"
                        ? "bg-green-500"
                        : thread.status === "running"
                          ? "bg-blue-500"
                          : thread.status === "failed"
                            ? "bg-red-500"
                            : "bg-stone-400"
                  }`}
                />
                <span className="flex-1 text-sm text-stone-700">
                  {thread.summary || thread.agentType}
                </span>
                <span className="text-xs text-stone-400">
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
