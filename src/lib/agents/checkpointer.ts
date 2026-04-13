import { MemorySaver } from "@langchain/langgraph";

let saver: MemorySaver | null = null;

export function getCheckpointer() {
  if (!saver) {
    saver = new MemorySaver();
  }
  return saver;
}
