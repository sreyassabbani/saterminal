import type { Attempt } from "./attempt.ts";

export type ProgressStatistics = {
  answered: number;
  correct: number;
  incorrect: number;
  corrected: number;
  mastered: number;
  accuracy: number;
  averageSeconds: number;
};

export function progressStatistics(attempts: Iterable<Attempt>): ProgressStatistics {
  const values = [...attempts];
  let correct = 0;
  let incorrect = 0;
  let corrected = 0;
  let totalSeconds = 0;
  for (const attempt of values) {
    if (attempt.outcome === "correct") correct += 1;
    else if (attempt.outcome === "incorrect") incorrect += 1;
    else corrected += 1;
    totalSeconds += attempt.durationSeconds;
  }
  const mastered = correct + corrected;
  return {
    answered: values.length,
    correct,
    incorrect,
    corrected,
    mastered,
    accuracy: values.length === 0 ? 0 : mastered / values.length,
    averageSeconds: values.length === 0 ? 0 : totalSeconds / values.length,
  };
}
