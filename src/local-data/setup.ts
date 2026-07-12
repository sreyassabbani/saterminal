import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { ensureDatabase } from "@/database/index.ts";
import { dataDirectory } from "@/local-data/paths.ts";
import { ensurePreferences } from "@/preferences/index.ts";

export async function ensureLocalData(directory = dataDirectory): Promise<void> {
  await mkdir(directory, { recursive: true });
  ensureDatabase(join(directory, "sat.db"));
  await ensurePreferences(join(directory, "preferences.json"));
  await createIgnoreFile(join(directory, ".ignore"));
}

async function createIgnoreFile(path: string): Promise<void> {
  try {
    const file = await open(path, "wx", 0o600);
    try {
      await file.writeFile("cache\n");
    } finally {
      await file.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
