import type { Attempt, SummaryRow } from "../types.ts";

export function buildSummaryRows(attempts: Map<string, Attempt>, now = new Date()): SummaryRow[] {
  const updated_at = now.toISOString();
  const values = [...attempts.values()];
  const total = values.length;
  const correct = values.filter((attempt) => attempt.outcome === "correct").length;
  const incorrect = values.filter((attempt) => attempt.outcome === "incorrect").length;
  const corrected = values.filter((attempt) => attempt.outcome === "corrected").length;
  const mastered = correct + corrected;
  const accuracy = total === 0 ? "0.00" : (mastered / total).toFixed(2);
  const totalSeconds = values.reduce((sum, attempt) => sum + attempt.elapsed_seconds, 0);
  return [
    { metric: "answered", value: String(total), updated_at },
    { metric: "correct", value: String(correct), updated_at },
    { metric: "incorrect", value: String(incorrect), updated_at },
    { metric: "corrected", value: String(corrected), updated_at },
    { metric: "accuracy", value: accuracy, updated_at },
    { metric: "avg_seconds", value: (total === 0 ? 0 : totalSeconds / total).toFixed(1), updated_at },
  ];
}
