#!/usr/bin/env bun
import { parseArgs, runCliCommand } from "./cli.ts";
import { runTui } from "./tui.ts";

const parsed = parseArgs(process.argv.slice(2));

if (parsed.kind === "tui") {
  await runTui();
} else if (parsed.kind === "review") {
  await runTui({ mode: "review" });
} else {
  process.exitCode = await runCliCommand(parsed);
}
