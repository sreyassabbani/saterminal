import type { Database } from "bun:sqlite";

export const stateSchemaVersion = 1;

export function migrate(sqlite: Database): void {
  const version = readUserVersion(sqlite);
  if (version > stateSchemaVersion) {
    throw new Error(`State database schema ${version} is newer than this app supports.`);
  }

  if (version < 1) {
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
      pragma user_version = ${stateSchemaVersion};
    `);
  }
}

export function readUserVersion(sqlite: Database): number {
  const row = sqlite.query("pragma user_version").get() as { user_version?: number } | undefined;
  return row?.user_version ?? 0;
}
