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
          className="flex-1 rounded-xl border border-white/30 bg-white/60 px-4 py-3 backdrop-blur-sm placeholder:text-stone-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>

      <div className="space-y-4">
        {pendingTodos.length === 0 && completedTodos.length === 0 ? (
          <p className="py-8 text-center text-stone-500">
            No tasks yet. Add one above to get started.
          </p>
        ) : (
          <>
            {pendingTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-sm"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  className="rounded-full p-1 text-stone-400 transition hover:bg-teal-100 hover:text-teal-600"
                  aria-label="Mark complete"
                >
                  <Circle className="h-5 w-5" />
                </button>
                <span className="flex-1 font-medium text-stone-900">{todo.title}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(todo.id)}
                  disabled={pending}
                  className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {completedTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/30 px-4 py-3 opacity-75"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  className="rounded-full p-1 text-teal-600 transition hover:bg-teal-100"
                  aria-label="Mark incomplete"
                >
                  <Check className="h-5 w-5" />
                </button>
                <span className="flex-1 text-stone-500 line-through">{todo.title}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(todo.id)}
                  disabled={pending}
                  className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
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
