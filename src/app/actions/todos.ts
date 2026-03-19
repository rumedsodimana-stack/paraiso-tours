"use server";

import { revalidatePath } from "next/cache";
import { getTodos, createTodo, updateTodo, deleteTodo } from "@/lib/db";

export async function addTodoAction(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Task description is required" };

  await createTodo({ title, completed: false });
  revalidatePath("/admin/todos");
  return { success: true };
}

export async function toggleTodoAction(id: string) {
  const todos = await getTodos();
  const todo = todos.find((t) => t.id === id);
  if (!todo) return { error: "Todo not found" };

  await updateTodo(id, { completed: !todo.completed });
  revalidatePath("/admin/todos");
  return { success: true };
}

export async function deleteTodoAction(id: string) {
  const ok = await deleteTodo(id);
  if (!ok) return { error: "Todo not found" };
  revalidatePath("/admin/todos");
  return { success: true };
}
