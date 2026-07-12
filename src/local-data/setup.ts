import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDatabase } from "@/database/index.ts";
import { dataDirectory } from "@/local-data/paths.ts";
import { ensurePreferences } from "@/preferences/index.ts";

export function ensureLocalData(directory = dataDirectory): void {
  mkdirSync(directory, { recursive: true });
  ensureDatabase(join(directory, "sat.db"));
  ensurePreferences(join(directory, "preferences.json"));
  createIgnoreFile(join(directory, ".ignore"));
}

function createIgnoreFile(path: string): void {
  try {
    writeFileSync(path, "cache\n", { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
