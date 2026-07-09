import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { asc, eq } from "drizzle-orm";
import { defaultFocus, normalizeFocus } from "../focus.ts";
import type { Attempt, AttemptEvent, Focus, Outcome, QuestionMeta } from "../types.ts";
import { databasePath, stateDir } from "./paths.ts";
import { attemptEventsTable, attemptsTable, focusTable } from "./schema.ts";
import { migrate } from "./migrations.ts";

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

function readOutcome(value: string): Outcome {
  if (value === "correct" || value === "incorrect" || value === "corrected") return value;
  throw new Error(`Invalid attempt outcome in database: ${value}`);
}

function optionalMetadata(metadata: Pick<Attempt, "difficulty" | "domain" | "domain_desc" | "skill" | "skill_desc">): Partial<Attempt> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value)) as Partial<Attempt>;
}
