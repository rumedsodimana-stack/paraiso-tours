"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Trash2 } from "lucide-react";
import { addTodoAction, toggleTodoAction, deleteTodoAction } from "@/app/actions/todos";
import type { Todo } from "@/lib/types";

export function TodosList({ initialTodos }: { initialTodos: Todo[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await addTodoAction(formData);
      if (result?.success) {
        form.reset();
        router.refresh();
      }
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleTodoAction(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTodoAction(id);
      router.refresh();
    });
  }

  const pendingTodos = initialTodos.filter((t) => !t.completed);
  const completedTodos = initialTodos.filter((t) => t.completed);

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          type="text"
          name="title"
          placeholder="Add a task…"
          disabled={pending}
          className="flex-1 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-3 text-sm text-[#11272b] placeholder:text-[#8a9ba1] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#12343b] px-6 py-3 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>

      <div className="space-y-4">
        {pendingTodos.length === 0 && completedTodos.length === 0 ? (
          <p className="py-8 text-center text-[#5e7279]">
            No tasks yet. Add one above to get started.
          </p>
        ) : (
          <>
            {pendingTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-3 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  className="rounded-full p-1 text-[#8a9ba1] transition hover:bg-[#eef4f4] hover:text-[#12343b]"
                  aria-label="Mark complete"
                >
                  <Circle className="h-5 w-5" />
                </button>
                <span className="flex-1 font-medium text-[#11272b]">{todo.title}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(todo.id)}
                  disabled={pending}
                  className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {completedTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd]/50 px-4 py-3 opacity-75"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  className="rounded-full p-1 text-[#12343b] transition hover:bg-[#eef4f4]"
                  aria-label="Mark incomplete"
                >
                  <Check className="h-5 w-5" />
                </button>
                <span className="flex-1 text-[#8a9ba1] line-through">{todo.title}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(todo.id)}
                  disabled={pending}
                  className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
