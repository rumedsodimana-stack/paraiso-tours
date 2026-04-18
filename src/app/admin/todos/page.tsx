import { getTodos } from "@/lib/db";
import { TodosList } from "./TodosList";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const todos = await getTodos();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#11272b]">Todo List</h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Track your tasks and reminders. Add, complete, or remove items.
        </p>
      </div>
      <div className="paraiso-card rounded-2xl p-6">
        <TodosList initialTodos={todos} />
      </div>
    </div>
  );
}
