import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { openDatabase } from "@/database/index.ts";
import { ensureLocalData } from "@/local-data/setup.ts";
import { loadAttemptEvents, loadAttempts, recordAnswer } from "@/database/progress-repository.ts";
import { createAnswerRecord } from "@/progress/attempt.ts";
import type { Question } from "@/questions/question.ts";

const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

function path(): string {
  const directory = mkdtempSync(join(tmpdir(), "saterminal-test-"));
  directories.push(directory);
  return join(directory, "sat.db");
}

const question: Question = {
  id: "q1", sourceId: "source-q1", difficulty: "H", domain: "INI", skill: "INF",
  prompt: "Infer.", choices: [{ key: "A", content: "Answer" }], correctAnswers: ["A"],
};

describe("database", () => {
  test("creates local data and a non-destructive cache ignore", () => {
    const directory = mkdtempSync(join(tmpdir(), "saterminal-setup-"));
    directories.push(directory);

    ensureLocalData(directory);

    expect(readFileSync(join(directory, ".ignore"), "utf8")).toBe("cache\n");
    expect(Bun.file(join(directory, "sat.db")).size).toBeGreaterThan(0);
    expect(Bun.file(join(directory, "preferences.json")).size).toBeGreaterThan(0);
    expect(Bun.file(join(directory, "preferences.schema.json")).size).toBeGreaterThan(0);

    writeFileSync(join(directory, ".ignore"), "custom\n");
    ensureLocalData(directory);
    expect(readFileSync(join(directory, ".ignore"), "utf8")).toBe("custom\n");
  });

  test("commits an answer event and latest attempt together", () => {
    const databasePath = path();
    recordAnswer(createAnswerRecord(undefined, question, "A", 14, new Date("2026-02-01T00:00:00.000Z")), databasePath);

    expect(loadAttempts(databasePath).get("q1")).toMatchObject({ outcome: "correct", durationSeconds: 14 });
    expect(loadAttemptEvents(databasePath)).toHaveLength(1);
  });

  test("rolls back the event when the latest-attempt write fails", () => {
    const databasePath = path();
    const database = openDatabase(databasePath);
    database.exec("create trigger reject_attempt before insert on attempts begin select raise(abort, 'rejected'); end;");
    database.close();

    expect(() => recordAnswer(createAnswerRecord(undefined, question, "A"), databasePath)).toThrow("rejected");
    expect(loadAttemptEvents(databasePath)).toEqual([]);
  });

  test("migrates existing version-one study data", () => {
    const databasePath = path();
    const database = new Database(databasePath);
    database.exec(`
      create table attempts (question_id text primary key, outcome text not null, updated_at text not null, elapsed_seconds integer not null, difficulty text, domain text, domain_desc text, skill text, skill_desc text);
      create table attempt_events (id integer primary key autoincrement, question_id text not null, correct integer not null, answered_at text not null, elapsed_seconds integer not null, difficulty text not null, domain text not null, domain_desc text, skill text not null, skill_desc text);
      create table focus (id integer primary key, difficulties text not null, domains text not null, skills text not null, updated_at text not null);
      insert into attempts values ('kept', 'incorrect', '2026-01-01T00:00:00.000Z', 42, 'M', 'CAS', 'Craft and Structure', 'WIC', 'Words in Context');
      pragma user_version = 1;
    `);
    database.close();

    expect(loadAttempts(databasePath).get("kept")).toMatchObject({ outcome: "incorrect", durationSeconds: 42, skill: "WIC" });
  });
});
