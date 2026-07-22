import type { Database } from "bun:sqlite";

export const schemaVersion = 3;

export function migrate(database: Database): void {
  const version = userVersion(database);
  if (version > schemaVersion) throw new Error(`Database schema ${version} is newer than this app supports.`);
  if (version === 0) createSchema(database);
  else {
    if (version === 1) migrateFromVersionOne(database);
    if (version <= 2) migrateFromVersionTwo(database);
  }
}

export function userVersion(database: Database): number {
  const row = database.query("pragma user_version").get() as { user_version?: number } | undefined;
  return row?.user_version ?? 0;
}

function createSchema(database: Database): void {
  database.exec(`
    begin;
    create table attempts (
      question_id text primary key,
      outcome text not null check (outcome in ('correct', 'incorrect', 'corrected')),
      answer text,
      answered_at text not null,
      duration_seconds integer not null default 0,
      difficulty text,
      domain text,
      skill text
    );
    create table attempt_events (
      id integer primary key autoincrement,
      question_id text not null,
      correct integer not null check (correct in (0, 1)),
      answered_at text not null,
      duration_seconds integer not null default 0,
      difficulty text not null,
      domain text not null,
      skill text not null
    );
    create table focus (
      id integer primary key check (id = 1),
      difficulties text not null,
      skills text not null,
      updated_at text not null
    );
    create index attempt_events_answered_at_idx on attempt_events(answered_at);
    create index attempt_events_question_id_idx on attempt_events(question_id);
    create index attempts_answered_at_idx on attempts(answered_at);
    pragma user_version = ${schemaVersion};
    commit;
  `);
}

function migrateFromVersionTwo(database: Database): void {
  database.exec(`
    begin;
    alter table attempts add column answer text;
    pragma user_version = ${schemaVersion};
    commit;
  `);
}

function migrateFromVersionOne(database: Database): void {
  database.exec(`
    begin;
    create table attempts_v2 (
      question_id text primary key,
      outcome text not null check (outcome in ('correct', 'incorrect', 'corrected')),
      answered_at text not null,
      duration_seconds integer not null default 0,
      difficulty text,
      domain text,
      skill text
    );
    insert into attempts_v2 select question_id, outcome, updated_at, elapsed_seconds, difficulty, domain, skill from attempts;
    drop table attempts;
    alter table attempts_v2 rename to attempts;

    create table attempt_events_v2 (
      id integer primary key autoincrement,
      question_id text not null,
      correct integer not null check (correct in (0, 1)),
      answered_at text not null,
      duration_seconds integer not null default 0,
      difficulty text not null,
      domain text not null,
      skill text not null
    );
    insert into attempt_events_v2 (id, question_id, correct, answered_at, duration_seconds, difficulty, domain, skill)
      select id, question_id, correct, answered_at, elapsed_seconds, difficulty, domain, skill from attempt_events;
    drop table attempt_events;
    alter table attempt_events_v2 rename to attempt_events;

    create table focus_v2 (
      id integer primary key check (id = 1),
      difficulties text not null,
      skills text not null,
      updated_at text not null
    );
    insert into focus_v2 (id, difficulties, skills, updated_at) select id, difficulties, skills, updated_at from focus;
    drop table focus;
    alter table focus_v2 rename to focus;

    create index attempt_events_answered_at_idx on attempt_events(answered_at);
    create index attempt_events_question_id_idx on attempt_events(question_id);
    create index attempts_answered_at_idx on attempts(answered_at);
    pragma user_version = 2;
    commit;
  `);
}
