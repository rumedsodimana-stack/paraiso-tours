import { writeFile, mkdir, access } from "fs/promises";
import path from "path";
import { mockPackages } from "./mock-data";

const DATA_DIR = path.join(process.cwd(), "data");
const SEEDED_FLAG = path.join(DATA_DIR, ".seeded");

/** Seeds only 10 tour packages. All other data (leads, tours) stays empty. */
export async function seedIfNeeded(): Promise<void> {
  try {
    await access(SEEDED_FLAG);
    return; // already seeded
  } catch {
    // not seeded yet
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, "leads.json"), JSON.stringify([], null, 2));
  await writeFile(path.join(DATA_DIR, "packages.json"), JSON.stringify(mockPackages, null, 2));
  await writeFile(path.join(DATA_DIR, "tours.json"), JSON.stringify([], null, 2));
  await writeFile(SEEDED_FLAG, "ok");
}
