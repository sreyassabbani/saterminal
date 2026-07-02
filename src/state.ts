import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import { defaultFocus, normalizeFocus } from "./focus.ts";
import type { Attempt, Focus, Outcome, SummaryRow } from "./types.ts";

export function resolveStateDir(home = homedir()): string {
  return join(home, ".saterminal", "userlocal");
}

export function displayStateDir(dir: string, home = homedir()): string {
  if (dir === home) {
    return "~";
  }

  const prefix = `${home}${sep}`;
  if (dir.startsWith(prefix)) {
    return `~${dir.slice(home.length)}`;
  }

  return dir;
}

export const stateDir = resolveStateDir();
export const attemptsPath = join(stateDir, "attempts.csv");
export const summaryPath = join(stateDir, "summary.csv");
export const focusPath = join(stateDir, "focus.json");

const attemptsHeader = "question_id,outcome,updated_at,elapsed_seconds";
const summaryHeader = "metric,value,updated_at";

export async function stateDirExists(dir = stateDir): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function ensureStateFiles(dir = stateDir): Promise<void> {
  await mkdir(dir, { recursive: true });
  await ensureFile(join(dir, "attempts.csv"), `${attemptsHeader}\n`);
  await ensureFile(join(dir, "summary.csv"), `${summaryHeader}\n`);
  await ensureFile(join(dir, "focus.json"), `${JSON.stringify(defaultFocus, null, 2)}\n`);
}

export async function loadAttempts(path = attemptsPath): Promise<Map<string, Attempt>> {
  await ensureFile(path, `${attemptsHeader}\n`);
  const raw = await readFile(path, "utf8");
  const rows = parseCsv(raw);
  const attempts = new Map<string, Attempt>();

  for (const row of rows.slice(1)) {
    const [question_id, outcome, updated_at, elapsed_seconds] = row;
    if (!question_id || !isOutcome(outcome) || !updated_at) {
      continue;
    }

    attempts.set(question_id, {
      question_id,
      outcome,
      updated_at,
      elapsed_seconds: readElapsedSeconds(elapsed_seconds),
    });
  }

  return attempts;
}

export async function saveAttempts(attempts: Map<string, Attempt>, path = attemptsPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const rows = [...attempts.values()]
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .map((attempt) => [attempt.question_id, attempt.outcome, attempt.updated_at, String(attempt.elapsed_seconds)]);

  await writeFile(path, formatCsv([attemptsHeader.split(","), ...rows]), "utf8");
}

export function recordAttempt(
  attempts: Map<string, Attempt>,
  questionId: string,
  wasCorrect: boolean,
  elapsedSeconds = 0,
  now = new Date(),
): Attempt {
  const existing = attempts.get(questionId);
  const updated_at = now.toISOString();
  const outcome = nextOutcome(existing?.outcome, wasCorrect);
  const attempt = { question_id: questionId, outcome, updated_at, elapsed_seconds: elapsedSeconds };
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
  const totalSeconds = values.reduce((sum, attempt) => sum + attempt.elapsed_seconds, 0);
  const avgSeconds = total === 0 ? 0 : totalSeconds / total;

  return [
    { metric: "answered", value: String(total), updated_at },
    { metric: "correct", value: String(correct), updated_at },
    { metric: "incorrect", value: String(incorrect), updated_at },
    { metric: "corrected", value: String(corrected), updated_at },
    { metric: "accuracy", value: accuracy, updated_at },
    { metric: "avg_seconds", value: avgSeconds.toFixed(1), updated_at },
  ];
}

export async function saveSummary(attempts: Map<string, Attempt>, path = summaryPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const rows = buildSummaryRows(attempts).map((row) => [row.metric, row.value, row.updated_at]);
  await writeFile(path, formatCsv([summaryHeader.split(","), ...rows]), "utf8");
}

export async function loadFocus(path = focusPath): Promise<Focus> {
  await ensureFile(path, `${JSON.stringify(defaultFocus, null, 2)}\n`);
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid focus file at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return normalizeFocus(parsed);
}

export async function saveFocus(focus: Focus, path = focusPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalizeFocus(focus), null, 2)}\n`, "utf8");
}

function isOutcome(value: string | undefined): value is Outcome {
  return value === "correct" || value === "incorrect" || value === "corrected";
}

function readElapsedSeconds(value: string | undefined): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
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
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
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
