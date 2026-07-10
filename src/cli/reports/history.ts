import type { Attempt } from "../../progress/attempt.ts";
import { ansi, duration, paint, table, type FormatSettings } from "./terminal-format.ts";

export function formatHistory(attempts: Attempt[], settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify(attempts);
  if (!attempts.length) return settings.mode === "pretty" ? `${paint("history", settings, ansi.bold, ansi.cyan)}\n${paint("No attempts matched.", settings, ansi.gray)}` : "No attempts matched.";
  if (settings.mode === "plain") return table(["question", "outcome", "answered at", "time"], attempts.map((attempt) => [attempt.questionId, attempt.outcome, attempt.answeredAt, duration(attempt.durationSeconds)]));
  const mastered = attempts.filter((attempt) => attempt.outcome !== "incorrect").length;
  const missed = attempts.length - mastered;
  return [
    paint("history", settings, ansi.bold, ansi.cyan),
    `${attempts.length} attempts  ${paint(String(mastered), settings, ansi.green, ansi.bold)} mastered  ${paint(String(missed), settings, missed ? ansi.red : ansi.gray, ansi.bold)} needs review`,
    "",
    table(["question", "result", "skill", "time", "updated"], attempts.map((attempt) => [attempt.questionId, attempt.outcome, attempt.skill ?? "-", duration(attempt.durationSeconds), timestamp(attempt.answeredAt)])),
  ].join("\n");
}

function timestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
