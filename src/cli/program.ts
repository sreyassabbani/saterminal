import { readFile } from "node:fs/promises";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { buildSummaryRows, loadAttemptEvents, loadAttempts, loadFocus } from "../state.ts";
import { resolveColor } from "./format/style.ts";
import { helpText } from "./help.ts";
import { formatFocus } from "./reports/focus.ts";
import { formatHistory } from "./reports/history.ts";
import { formatStats } from "./reports/stats.ts";
import { formatWeak } from "./reports/weak.ts";
import type { CliCommand, FormatOptions, HistoryFilters, OutputFormat, ParsedCli, Writable } from "./types.ts";

const reportCommands = new Set<CliCommand>(["history", "stats", "focus", "weak"]);

type CommanderOptions = {
  pretty?: boolean;
  json?: boolean;
  color?: boolean;
  wrong?: boolean;
  corrected?: boolean;
  limit?: number;
  since?: string;
};

export function parseArgs(args: string[]): ParsedCli {
  if (args.length === 0) {
    return { kind: "tui" };
  }

  if (args.includes("-h") || args.includes("--help") || args.includes("help")) {
    return { kind: "help" };
  }

  if (args.includes("-V") || args.includes("--version")) {
    return { kind: "version" };
  }

  let parsed: ParsedCli | undefined;
  const program = createProgram((value) => {
    parsed = value;
  });

  try {
    program.parse(["bun", "sat", ...args]);
  } catch (error) {
    return commanderError(error, args);
  }

  return parsed ?? { kind: "error", message: "Missing command. Use `sat history`, `sat stats`, `sat focus`, `sat weak`, or `sat review`." };
}

export async function runCliCommand(
  parsed: Exclude<ParsedCli, { kind: "tui" | "review" }>,
  stdout: Writable = process.stdout,
  stderr: Writable = process.stderr,
): Promise<number> {
  if (parsed.kind === "help") {
    stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (parsed.kind === "version") {
    stdout.write(`sat ${await packageVersion()}\n`);
    return 0;
  }

  if (parsed.kind === "error") {
    stderr.write(`${parsed.message}\n\n${helpText()}\n`);
    return 1;
  }

  const color = parsed.format === "pretty" ? resolveColor(parsed.color, stdout) : false;
  const output = await commandOutput(parsed.command, parsed.format, {
    color,
    filters: parsed.filters,
  });
  stdout.write(`${output}\n`);
  return 0;
}

export async function commandOutput(command: CliCommand, format: OutputFormat, options: FormatOptions = {}): Promise<string> {
  if (command === "history") {
    const attempts = await loadAttempts();
    return formatHistory([...attempts.values()], format, options);
  }

  if (command === "stats") {
    const attempts = await loadAttempts();
    const events = await loadAttemptEvents();
    return formatStats(buildSummaryRows(attempts), format, { ...options, events });
  }

  if (command === "weak") {
    const attempts = await loadAttempts();
    return formatWeak([...attempts.values()], format, options);
  }

  return formatFocus(await loadFocus(), format, options);
}

function createProgram(assign: (parsed: ParsedCli) => void): Command {
  const program = new Command();
  program
    .name("sat")
    .exitOverride()
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .configureOutput({
      writeOut() {},
      writeErr() {},
      outputError() {},
    })
    .option("-p, --pretty")
    .option("--json")
    .option("--no-color")
    .option("--wrong")
    .option("--corrected")
    .option("--limit <value>", "Limit rows", parseLimit)
    .option("--since <value>", "Show rows since a date or relative duration", parseSinceOption);

  for (const command of reportCommands) {
    program
      .command(command)
      .allowUnknownOption(false)
      .allowExcessArguments(false)
      .action(() => assign(parsedReport(command, program.opts<CommanderOptions>())));
  }

  program
    .command("review")
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .action(() => {
      const options = program.opts<CommanderOptions>();
      assign(options.pretty || options.json || hasHistoryFilters(readFilters(options))
        ? { kind: "error", message: "`sat review` opens the TUI and does not support report flags." }
        : { kind: "review" });
    });

  return program;
}

function parsedReport(command: CliCommand, options: CommanderOptions): ParsedCli {
  const filters = readFilters(options);

  if (options.pretty && options.json) {
    return { kind: "error", message: "Choose either `--pretty` or `--json`, not both." };
  }

  if (command !== "history" && hasHistoryFilters(filters)) {
    return { kind: "error", message: "History filters only work with `sat history`." };
  }

  return {
    kind: "command",
    command,
    format: options.json ? "json" : options.pretty ? "pretty" : "text",
    ...(options.color === false ? { color: false } : {}),
    ...(command === "history" && hasHistoryFilters(filters) ? { filters } : {}),
  };
}

function readFilters(options: CommanderOptions): HistoryFilters {
  return {
    ...(options.wrong ? { wrong: true } : {}),
    ...(options.corrected ? { corrected: true } : {}),
    ...(options.limit ? { limit: options.limit } : {}),
    ...(options.since ? { since: options.since } : {}),
  };
}

function parseLimit(value: string): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new InvalidArgumentError("`--limit` must be a positive integer.");
  }
  return limit;
}

function parseSinceOption(value: string): string {
  if (!isSinceValue(value)) {
    throw new InvalidArgumentError("`--since` must be an ISO date or a relative value like `7d` or `2w`.");
  }
  return value;
}

function commanderError(error: unknown, args: string[]): ParsedCli {
  if (!(error instanceof CommanderError)) {
    throw error;
  }

  if (error.code === "commander.unknownOption") {
    return { kind: "error", message: `Unknown option: ${readUnknownOption(error.message)}` };
  }

  if (error.code === "commander.unknownCommand") {
    return { kind: "error", message: `Unknown command: ${readUnknownCommand(error.message, args)}` };
  }

  if (error.code === "commander.excessArguments") {
    return { kind: "error", message: `Unexpected argument: ${args[args.length - 1] ?? ""}` };
  }

  if (error.code === "commander.optionMissingArgument") {
    return { kind: "error", message: error.message.includes("--limit") ? "Missing value for `--limit`." : "Missing value for `--since`." };
  }

  if (error.code === "commander.invalidArgument") {
    return { kind: "error", message: error.message.replace(/^error: /, "") };
  }

  return { kind: "error", message: error.message.replace(/^error: /, "") };
}

function readUnknownOption(message: string): string {
  return /'([^']+)'/.exec(message)?.[1] ?? message.split(/\s+/).at(-1) ?? "";
}

function readUnknownCommand(message: string, args: string[]): string {
  return /'([^']+)'/.exec(message)?.[1] ?? args.find((arg) => !arg.startsWith("-")) ?? "";
}

function isSinceValue(value: string): boolean {
  return /^(\d+)(d|w)$/.test(value) || !Number.isNaN(new Date(value).getTime());
}

function hasHistoryFilters(filters: HistoryFilters): boolean {
  return Boolean(filters.wrong || filters.corrected || filters.limit || filters.since);
}

async function packageVersion(): Promise<string> {
  const packageJson = await readFile(new URL("../../package.json", import.meta.url), "utf8");
  const parsed = JSON.parse(packageJson) as { version?: unknown };
  return typeof parsed.version === "string" && parsed.version ? parsed.version : "unknown";
}
