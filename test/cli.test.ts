import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

async function run(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
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
  return { code, stdout, stderr };
}

describe("cli", () => {
  test("offers discoverable practice and reporting commands", async () => {
    const result = await run("--help");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("review");
    expect(result.stdout).toContain("weak");
    expect(result.stdout).toContain("stats");
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
