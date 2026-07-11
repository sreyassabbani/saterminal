import type { Attempt, AttemptEvent } from "./attempt.ts";

export type ReviewRequirements = {
  minimumDays: number;
  minimumAnswersAfter: number;
};

export function reviewQueue(
  attempts: Iterable<Attempt>,
  events: Iterable<AttemptEvent>,
  requirements: ReviewRequirements,
  now = new Date(),
): string[] {
  const eventTimes = [...events]
    .map((event) => new Date(event.answeredAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const minimumAge = requirements.minimumDays * 86_400_000;
  return [...attempts]
    .filter((attempt) => {
      if (attempt.outcome !== "incorrect" && attempt.outcome !== "corrected") return false;
      const answeredAt = new Date(attempt.answeredAt).getTime();
      return Number.isFinite(answeredAt)
        && now.getTime() - answeredAt >= minimumAge
        && answersAfter(eventTimes, answeredAt) >= requirements.minimumAnswersAfter;
    })
    .sort((a, b) => priority(a) - priority(b) || a.answeredAt.localeCompare(b.answeredAt))
    .map((attempt) => attempt.questionId);
}

function answersAfter(sortedTimes: readonly number[], answeredAt: number): number {
  let low = 0;
  let high = sortedTimes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sortedTimes[middle] <= answeredAt) low = middle + 1;
    else high = middle;
  }
  return sortedTimes.length - low;
}

function priority(attempt: Attempt): number {
  return attempt.outcome === "incorrect" ? 0 : 1;
}
