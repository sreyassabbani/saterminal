import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Attempt, Outcome, SummaryRow } from "./types.ts";

export const stateDir = "userlocal";
export const attemptsPath = join(stateDir, "attempts.csv");
export const summaryPath = join(stateDir, "summary.csv");

const attemptsHeader = "question_id,outcome,updated_at";
const summaryHeader = "metric,value,updated_at";

export async function ensureStateFiles(): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  await ensureFile(attemptsPath, `${attemptsHeader}\n`);
  await ensureFile(summaryPath, `${summaryHeader}\n`);
}

export async function loadAttempts(path = attemptsPath): Promise<Map<string, Attempt>> {
  await ensureFile(path, `${attemptsHeader}\n`);
  const raw = await readFile(path, "utf8");
  const rows = parseCsv(raw);
  const attempts = new Map<string, Attempt>();

  for (const row of rows.slice(1)) {
    const [question_id, outcome, updated_at] = row;
    if (!question_id || !isOutcome(outcome) || !updated_at) {
      continue;
    }

    attempts.set(question_id, { question_id, outcome, updated_at });
  }

  return attempts;
}

export async function saveAttempts(attempts: Map<string, Attempt>, path = attemptsPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const rows = [...attempts.values()]
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .map((attempt) => [attempt.question_id, attempt.outcome, attempt.updated_at]);

  await writeFile(path, formatCsv([attemptsHeader.split(","), ...rows]), "utf8");
}

export function recordAttempt(
  attempts: Map<string, Attempt>,
  questionId: string,
  wasCorrect: boolean,
  now = new Date(),
): Attempt {
  const existing = attempts.get(questionId);
  const updated_at = now.toISOString();
  const outcome = nextOutcome(existing?.outcome, wasCorrect);
  const attempt = { question_id: questionId, outcome, updated_at };
  attempts.set(questionId, attempt);
  return attempt;
}

export function nextOutcome(previous: Outcome | undefined, wasCorrect: boolean): Outcome {
  if (previous === "correct" || previous === "corrected") {
    return previous;
  }

  if (previous === "incorrect" && wasCorrect) {
    return "corrected";
  }

  return wasCorrect ? "correct" : "incorrect";
}

export function buildSummaryRows(attempts: Map<string, Attempt>, now = new Date()): SummaryRow[] {
  const updated_at = now.toISOString();
  const values = [...attempts.values()];
  const total = values.length;
  const correct = values.filter((attempt) => attempt.outcome === "correct").length;
  const incorrect = values.filter((attempt) => attempt.outcome === "incorrect").length;
  const corrected = values.filter((attempt) => attempt.outcome === "corrected").length;
  const mastered = correct + corrected;
  const accuracy = total === 0 ? "0.00" : (mastered / total).toFixed(2);

  return [
    { metric: "answered", value: String(total), updated_at },
    { metric: "correct", value: String(correct), updated_at },
    { metric: "incorrect", value: String(incorrect), updated_at },
    { metric: "corrected", value: String(corrected), updated_at },
    { metric: "accuracy", value: accuracy, updated_at },
  ];
}

export async function saveSummary(attempts: Map<string, Attempt>, path = summaryPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const rows = buildSummaryRows(attempts).map((row) => [row.metric, row.value, row.updated_at]);
  await writeFile(path, formatCsv([summaryHeader.split(","), ...rows]), "utf8");
}

function isOutcome(value: string | undefined): value is Outcome {
  return value === "correct" || value === "incorrect" || value === "corrected";
}

async function ensureFile(path: string, contents: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
  }
}

function parseCsv(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((value) => value.trim()));
}

function formatCsv(rows: string[][]): string {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function csvEscape(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\"", "\"\"")}"`;
}
