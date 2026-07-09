import type { Attempt } from "../types.ts";

export function reviewQuestionIds(attempts: Map<string, Attempt>): string[] {
  return [...attempts.values()]
    .filter((attempt) => attempt.outcome === "incorrect" || attempt.outcome === "corrected")
    .sort((a, b) => reviewPriority(a) - reviewPriority(b) || a.updated_at.localeCompare(b.updated_at))
    .map((attempt) => attempt.question_id);
}

function reviewPriority(attempt: Attempt): number {
  return attempt.outcome === "incorrect" ? 0 : 1;
}
