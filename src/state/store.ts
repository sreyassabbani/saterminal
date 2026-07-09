import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { asc, eq } from "drizzle-orm";
import { defaultFocus, normalizeFocus } from "../focus.ts";
import type { Attempt, AttemptEvent, Focus, Outcome, QuestionMeta, SummaryRow } from "../types.ts";
import { databasePath, stateDir } from "./paths.ts";
import { attemptEventsTable, attemptsTable, focusTable } from "./schema.ts";

export async function stateDirExists(dir = stateDir): Promise<boolean> {
  try { return (await stat(dir)).isDirectory(); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function ensureStateFiles(path = databasePath): Promise<void> {
  const store = await openStore(path);
  store.close();
}

export async function loadAttempts(path = databasePath): Promise<Map<string, Attempt>> {
  const store = await openStore(path);
  try {
    const rows = store.db.select().from(attemptsTable).orderBy(asc(attemptsTable.updatedAt)).all();
    return new Map(rows.map((row) => [row.questionId, {
      question_id: row.questionId,
      outcome: readOutcome(row.outcome),
      updated_at: row.updatedAt,
      elapsed_seconds: row.elapsedSeconds,
      ...optionalMetadata({ difficulty: row.difficulty ?? undefined, domain: row.domain ?? undefined, domain_desc: row.domainDesc ?? undefined, skill: row.skill ?? undefined, skill_desc: row.skillDesc ?? undefined }),
    }]));
  } finally { store.close(); }
}

export async function saveAttempts(attempts: Map<string, Attempt>, path = databasePath): Promise<void> {
  const store = await openStore(path);
  try {
    const tx = store.sqlite.transaction((values: Attempt[]) => {
      store.sqlite.prepare("delete from attempts").run();
      const insert = store.sqlite.prepare(`insert into attempts (question_id, outcome, updated_at, elapsed_seconds, difficulty, domain, domain_desc, skill, skill_desc) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const attempt of values) insert.run(attempt.question_id, attempt.outcome, attempt.updated_at, attempt.elapsed_seconds, attempt.difficulty ?? null, attempt.domain ?? null, attempt.domain_desc ?? null, attempt.skill ?? null, attempt.skill_desc ?? null);
    });
    tx([...attempts.values()].sort((a, b) => a.updated_at.localeCompare(b.updated_at)));
  } finally { store.close(); }
}

export async function loadAttemptEvents(path = databasePath): Promise<AttemptEvent[]> {
  const store = await openStore(path);
  try {
    return store.db.select().from(attemptEventsTable).orderBy(asc(attemptEventsTable.answeredAt), asc(attemptEventsTable.id)).all().map((row) => ({
      question_id: row.questionId,
      correct: row.correct,
      answered_at: row.answeredAt,
      elapsed_seconds: row.elapsedSeconds,
      difficulty: row.difficulty,
      domain: row.domain,
      domain_desc: row.domainDesc ?? undefined,
      skill: row.skill,
      skill_desc: row.skillDesc ?? undefined,
    }));
  } finally { store.close(); }
}

export async function appendAttemptEvent(meta: QuestionMeta, correct: boolean, elapsedSeconds = 0, now = new Date(), path = databasePath): Promise<AttemptEvent> {
  const event: AttemptEvent = {
    question_id: meta.questionId,
    correct,
    answered_at: now.toISOString(),
    elapsed_seconds: elapsedSeconds,
    difficulty: meta.difficulty,
    domain: meta.primary_class_cd,
    domain_desc: meta.primary_class_cd_desc,
    skill: meta.skill_cd,
    skill_desc: meta.skill_desc,
  };
  const store = await openStore(path);
  try {
    store.db.insert(attemptEventsTable).values({
      questionId: event.question_id,
      correct: event.correct,
      answeredAt: event.answered_at,
      elapsedSeconds: event.elapsed_seconds,
      difficulty: event.difficulty,
      domain: event.domain,
      domainDesc: event.domain_desc,
      skill: event.skill,
      skillDesc: event.skill_desc,
    }).run();
    return event;
  } finally { store.close(); }
}

export function recordAttempt(attempts: Map<string, Attempt>, questionId: string, wasCorrect: boolean, elapsedSeconds = 0, now = new Date(), meta?: QuestionMeta): Attempt {
  const existing = attempts.get(questionId);
  const attempt = { question_id: questionId, outcome: nextOutcome(existing?.outcome, wasCorrect), updated_at: now.toISOString(), elapsed_seconds: elapsedSeconds, ...metadataFromQuestionMeta(meta) };
  attempts.set(questionId, attempt);
  return attempt;
}

export function nextOutcome(previous: Outcome | undefined, wasCorrect: boolean): Outcome {
  if (previous === "correct" || previous === "corrected") return previous;
  if (previous === "incorrect" && wasCorrect) return "corrected";
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
  return [
    { metric: "answered", value: String(total), updated_at },
    { metric: "correct", value: String(correct), updated_at },
    { metric: "incorrect", value: String(incorrect), updated_at },
    { metric: "corrected", value: String(corrected), updated_at },
    { metric: "accuracy", value: accuracy, updated_at },
    { metric: "avg_seconds", value: (total === 0 ? 0 : totalSeconds / total).toFixed(1), updated_at },
  ];
}

export async function saveSummary(_attempts: Map<string, Attempt>, _path = databasePath): Promise<void> {}

export async function loadFocus(path = databasePath): Promise<Focus> {
  const store = await openStore(path);
  try {
    const row = store.db.select().from(focusTable).where(eq(focusTable.id, 1)).get();
    return row ? normalizeFocus({ difficulties: row.difficulties, domains: row.domains, skills: row.skills }) : defaultFocus;
  } finally { store.close(); }
}

export async function saveFocus(focus: Focus, path = databasePath): Promise<void> {
  const normalized = normalizeFocus(focus);
  const store = await openStore(path);
  try {
    store.sqlite.prepare(`insert into focus (id, difficulties, domains, skills, updated_at) values (1, ?, ?, ?, ?) on conflict(id) do update set difficulties = excluded.difficulties, domains = excluded.domains, skills = excluded.skills, updated_at = excluded.updated_at`).run(JSON.stringify(normalized.difficulties), JSON.stringify(normalized.domains), JSON.stringify(normalized.skills), new Date().toISOString());
  } finally { store.close(); }
}

type Store = { sqlite: Database; db: ReturnType<typeof drizzle>; close: () => void };

async function openStore(path: string): Promise<Store> {
  await mkdir(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.exec("pragma journal_mode = WAL; pragma foreign_keys = ON; pragma busy_timeout = 5000;");
  migrate(sqlite);
  return { sqlite, db: drizzle(sqlite), close: () => sqlite.close() };
}

function migrate(sqlite: Database): void {
  sqlite.exec(`
    create table if not exists attempts (
      question_id text primary key,
      outcome text not null check (outcome in ('correct', 'incorrect', 'corrected')),
      updated_at text not null,
      elapsed_seconds integer not null default 0,
      difficulty text,
      domain text,
      domain_desc text,
      skill text,
      skill_desc text
    );
    create table if not exists attempt_events (
      id integer primary key autoincrement,
      question_id text not null,
      correct integer not null check (correct in (0, 1)),
      answered_at text not null,
      elapsed_seconds integer not null default 0,
      difficulty text not null default '',
      domain text not null default '',
      domain_desc text,
      skill text not null default '',
      skill_desc text
    );
    create table if not exists focus (
      id integer primary key check (id = 1),
      difficulties text not null,
      domains text not null,
      skills text not null,
      updated_at text not null
    );
    create index if not exists attempt_events_answered_at_idx on attempt_events(answered_at);
    create index if not exists attempt_events_question_id_idx on attempt_events(question_id);
    create index if not exists attempts_updated_at_idx on attempts(updated_at);
  `);
}

function readOutcome(value: string): Outcome {
  if (value === "correct" || value === "incorrect" || value === "corrected") return value;
  throw new Error(`Invalid attempt outcome in database: ${value}`);
}

function metadataFromQuestionMeta(meta: QuestionMeta | undefined): Partial<Attempt> {
  return meta ? optionalMetadata({ difficulty: meta.difficulty, domain: meta.primary_class_cd, domain_desc: meta.primary_class_cd_desc, skill: meta.skill_cd, skill_desc: meta.skill_desc }) : {};
}

function optionalMetadata(metadata: Pick<Attempt, "difficulty" | "domain" | "domain_desc" | "skill" | "skill_desc">): Partial<Attempt> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value)) as Partial<Attempt>;
}
