import type { Attempt } from "./attempt.ts";

export function reviewQueue(attempts: Iterable<Attempt>): string[] {
  return [...attempts]
    .filter((attempt) => attempt.outcome === "incorrect" || attempt.outcome === "corrected")
    .sort((a, b) => priority(a) - priority(b) || a.answeredAt.localeCompare(b.answeredAt))
    .map((attempt) => attempt.questionId);
}

function priority(attempt: Attempt): number {
  return attempt.outcome === "incorrect" ? 0 : 1;
}
