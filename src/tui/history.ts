import type { Attempt } from "../types.ts";
import type { AppState } from "./types.ts";

export function historyRows(state: AppState): Attempt[] {
  return [...state.attempts.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
