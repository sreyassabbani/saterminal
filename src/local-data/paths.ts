import { homedir } from "node:os";
import { join, sep } from "node:path";

export function resolveDataDirectory(home = homedir()): string {
  return join(home, ".saterminal");
}

export const dataDirectory = resolveDataDirectory();
export const databasePath = join(dataDirectory, "sat.db");
export const preferencesPath = join(dataDirectory, "preferences.json");
export const preferencesSchemaPath = join(dataDirectory, "preferences.schema.json");
export const questionBankCachePath = join(dataDirectory, "cache", "question-bank.json");

export function displayPath(path: string, home = homedir()): string {
  if (path === home) return "~";
  return path.startsWith(`${home}${sep}`) ? `~${path.slice(home.length)}` : path;
}
