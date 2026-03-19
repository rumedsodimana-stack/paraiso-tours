import { getTodos } from "@/lib/db";
import { TodosList } from "./TodosList";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const todos = await getTodos();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Todo List
        </h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          Track your tasks and reminders. Add, complete, or remove items.
        </p>
      </div>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <TodosList initialTodos={todos} />
      </div>
    </div>
  );
}
