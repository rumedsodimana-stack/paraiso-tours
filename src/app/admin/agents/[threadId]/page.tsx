import { getAgentThread, getAgentTasks } from "@/lib/agents/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThreadDetail } from "./ThreadDetail";

export default async function AgentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const thread = await getAgentThread(threadId);
  if (!thread) notFound();
  const tasks = await getAgentTasks(threadId);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/agents"
        className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to agents
      </Link>
      <ThreadDetail thread={thread} tasks={tasks} />
    </div>
  );
}
