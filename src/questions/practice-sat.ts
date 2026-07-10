import { spawn } from "node:child_process";
import type { Question } from "./question.ts";

export const practiceSatSite = "https://practicesat.vercel.app";

export function questionPageUrl(question: Question): string {
  return `${practiceSatSite}/question/${encodeURIComponent(question.id)}`;
}

export function openQuestionPage(question: Question): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(command, [questionPageUrl(question)], { detached: true, stdio: "ignore" });
  child.unref();
}
