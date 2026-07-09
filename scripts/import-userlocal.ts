#!/usr/bin/env bun
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { defaultFocus, normalizeFocus } from "../src/focus.ts";
import { cacheDir, legacyCacheDir, legacyStateDir } from "../src/state/paths.ts";
import { appendAttemptEvent, loadAttempts, saveAttempts, saveFocus } from "../src/state/store.ts";
import type { Attempt, QuestionMeta } from "../src/types.ts";

const attemptsPath = join(legacyStateDir, "attempts.csv");
const eventsPath = join(legacyStateDir, "events.csv");
const focusPath = join(legacyStateDir, "focus.json");

const attempts = await loadAttempts();
for (const row of await readCsv(attemptsPath)) {
  const [question_id, outcome, updated_at, elapsed_seconds, difficulty, domain, domain_desc, skill, skill_desc] = row;
  if (!question_id || !isOutcome(outcome) || !updated_at) continue;
  const attempt: Attempt = {
    question_id,
    outcome,
    updated_at,
    elapsed_seconds: readSeconds(elapsed_seconds),
    ...(difficulty ? { difficulty } : {}),
    ...(domain ? { domain } : {}),
    ...(domain_desc ? { domain_desc } : {}),
    ...(skill ? { skill } : {}),
    ...(skill_desc ? { skill_desc } : {}),
  };
  attempts.set(question_id, attempt);
}
await saveAttempts(attempts);

let importedEvents = 0;
for (const row of await readCsv(eventsPath)) {
  const [question_id, correct, answered_at, elapsed_seconds, difficulty, domain, domain_desc, skill, skill_desc] = row;
  if (!question_id || !isBooleanText(correct) || !answered_at) continue;
  await appendAttemptEvent({
    questionId: question_id,
    uId: question_id,
    external_id: question_id,
    difficulty: difficulty ?? "",
    primary_class_cd: domain ?? "",
    primary_class_cd_desc: domain_desc || undefined,
    skill_cd: skill ?? "",
    skill_desc: skill_desc || undefined,
  } satisfies QuestionMeta, correct === "true", readSeconds(elapsed_seconds), new Date(answered_at));
  importedEvents += 1;
}

try {
  const raw = await readFile(focusPath, "utf8");
  await saveFocus(normalizeFocus(JSON.parse(raw)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  await saveFocus(defaultFocus);
}

const movedCache = await moveLegacyCache();
await rm(legacyStateDir, { recursive: true, force: true });

console.log(`imported ${attempts.size} attempts and ${importedEvents} events from ${legacyStateDir}`);
console.log(movedCache ? `moved cache to ${cacheDir}` : `cleared ${legacyStateDir}`);

async function readCsv(path: string): Promise<string[][]> {
  try {
    const rows = parseCsv(await readFile(path, "utf8"));
    return rows.slice(1);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function isOutcome(value: string | undefined): value is Attempt["outcome"] {
  return value === "correct" || value === "incorrect" || value === "corrected";
}

function isBooleanText(value: string | undefined): value is "true" | "false" {
  return value === "true" || value === "false";
}

function readSeconds(value: string | undefined): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
}

async function moveLegacyCache(): Promise<boolean> {
  if (!await pathExists(legacyCacheDir)) return false;
  if (await pathExists(cacheDir)) return false;

  await mkdir(join(cacheDir, ".."), { recursive: true });
  await rename(legacyCacheDir, cacheDir);
  return true;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
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
      if (char === '"' && next === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(field.trim()); field = ""; }
    else if (char === "\n") { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field.length > 0 || row.length > 0) { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}
