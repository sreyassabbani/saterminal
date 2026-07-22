import type { Database } from "bun:sqlite";
import type { Difficulty, DomainCode, SkillCode } from "@/questions/question.ts";
import type { AnswerRecord, Attempt, AttemptEvent, Outcome } from "@/progress/attempt.ts";
import { databasePath } from "@/local-data/paths.ts";
import { openDatabase } from "@/database/index.ts";

export function loadAttempts(path = databasePath): Map<string, Attempt> {
  return usingDatabase(path, (database) => {
    const rows = database.query(`select question_id, outcome, answer, answered_at, duration_seconds, difficulty, domain, skill from attempts order by answered_at`).all() as AttemptRow[];
    return new Map(rows.map((row) => {
      const attempt = readAttempt(row);
      return [attempt.questionId, attempt];
    }));
  });
}

export function loadAttemptEvents(path = databasePath): AttemptEvent[] {
  return usingDatabase(path, (database) => {
    const rows = database.query(`select question_id, correct, answered_at, duration_seconds, difficulty, domain, skill from attempt_events order by answered_at, id`).all() as EventRow[];
    return rows.map((row) => ({
      questionId: row.question_id,
      correct: row.correct === 1,
      answeredAt: row.answered_at,
      durationSeconds: row.duration_seconds,
      difficulty: row.difficulty as Difficulty,
      domain: row.domain as DomainCode,
      skill: row.skill as SkillCode,
    }));
  });
}

export function recordAnswer(record: AnswerRecord, path = databasePath): void {
  usingDatabase(path, (database) => {
    const transaction = database.transaction(() => {
      const { event, attempt } = record;
      database.query(`insert into attempt_events (question_id, correct, answered_at, duration_seconds, difficulty, domain, skill) values (?, ?, ?, ?, ?, ?, ?)`)
        .run(event.questionId, event.correct ? 1 : 0, event.answeredAt, event.durationSeconds, event.difficulty, event.domain, event.skill);
      database.query(`insert into attempts (question_id, outcome, answer, answered_at, duration_seconds, difficulty, domain, skill) values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(question_id) do update set outcome = excluded.outcome, answer = excluded.answer, answered_at = excluded.answered_at, duration_seconds = excluded.duration_seconds, difficulty = excluded.difficulty, domain = excluded.domain, skill = excluded.skill`)
        .run(attempt.questionId, attempt.outcome, attempt.answer ?? null, attempt.answeredAt, attempt.durationSeconds, attempt.difficulty ?? null, attempt.domain ?? null, attempt.skill ?? null);
    });
    transaction();
  });
}

type AttemptRow = {
  question_id: string;
  outcome: string;
  answer: string | null;
  answered_at: string;
  duration_seconds: number;
  difficulty: string | null;
  domain: string | null;
  skill: string | null;
};

type EventRow = {
  question_id: string;
  correct: number;
  answered_at: string;
  duration_seconds: number;
  difficulty: string;
  domain: string;
  skill: string;
};

function readAttempt(row: AttemptRow): Attempt {
  return {
    questionId: row.question_id,
    outcome: readOutcome(row.outcome),
    ...(row.answer ? { answer: row.answer } : {}),
    answeredAt: row.answered_at,
    durationSeconds: row.duration_seconds,
    ...(row.difficulty ? { difficulty: row.difficulty as Difficulty } : {}),
    ...(row.domain ? { domain: row.domain as DomainCode } : {}),
    ...(row.skill ? { skill: row.skill as SkillCode } : {}),
  };
}

function readOutcome(value: string): Outcome {
  if (value === "correct" || value === "incorrect" || value === "corrected") return value;
  throw new Error(`Invalid attempt outcome in database: ${value}`);
}

function usingDatabase<T>(path: string, work: (database: Database) => T): T {
  const database = openDatabase(path);
  try {
    return work(database);
  } finally {
    database.close();
  }
}
