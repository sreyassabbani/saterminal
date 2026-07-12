import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

async function run(...args: string[]): Promise<{ code: number; stdout: string; stderr: string; home: string }> {
  const home = mkdtempSync(join(tmpdir(), "saterminal-home-"));
  directories.push(home);
  const process = Bun.spawn([processExecPath(), "run", "src/cli/index.ts", ...args], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...Bun.env, HOME: home, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return { code, stdout, stderr, home };
}

describe("cli", () => {
  test("offers discoverable practice and reporting commands", async () => {
    const result = await run("--help");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("review");
    expect(result.stdout).toContain("weak");
    expect(result.stdout).toContain("stats");
    expect(result.stdout).toContain("show");
    expect(result.stdout).toContain("config");
  });

  test("shows a question by ID", async () => {
    const result = await run("show", "03c9f327");

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Question 03c9f327");
    expect(result.stdout).toContain("Which choice best states the main purpose of the text?");
    expect(result.stdout).toContain("Correct answer: A");
    expect(result.stdout).toContain("Explanation");
  });

  test("reports an unknown question ID", async () => {
    const result = await run("show", "not-a-question");

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("question not-a-question was not found");
  });

  test("updates review preferences through the nested config command", async () => {
    const result = await run("config", "set", "--minimum-days", "14", "--minimum-answers-after", "250");
    const saved = await Bun.file(join(result.home, ".saterminal", "preferences.json")).json();

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("14 days · 250 later answers");
    expect(saved).toEqual({ review: { minimumDays: 14, minimumAnswersAfter: 250 } });
  });

  test("emits clean machine-readable reports", async () => {
    const result = await run("stats", "--json");
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({ answered: 0, accuracy: 0, activity: { totalAnswers: 0 } });
  });
});

function processExecPath(): string {
  return process.execPath;
}
