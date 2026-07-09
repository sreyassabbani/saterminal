import { homedir } from "node:os";
import { join, sep } from "node:path";

export function resolveStateDir(home = homedir()): string {
  return join(home, ".saterminal");
}

export function displayStateDir(dir: string, home = homedir()): string {
  if (dir === home) return "~";
  const prefix = `${home}${sep}`;
  return dir.startsWith(prefix) ? `~${dir.slice(home.length)}` : dir;
}

export const stateDir = resolveStateDir();
export const databasePath = join(stateDir, "sat.db");
export const cacheDir = join(stateDir, "cache");
export const legacyStateDir = join(stateDir, "userlocal");
export const legacyCacheDir = join(legacyStateDir, "cache");
