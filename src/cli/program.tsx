import { Command } from "commander";
import { render } from "ink";
import type { ComponentType } from "react";
import { z } from "zod";
import packageJson from "../../package.json" with { type: "json" };
import CommandApp from "@/cli/commands/_app.tsx";
import SetConfigCommand, { options as setConfigOptions } from "@/cli/commands/config/set.tsx";
import ResetConfigCommand from "@/cli/commands/config/reset.tsx";
import ConfigCommand from "@/cli/commands/config/index.tsx";
import FocusCommand from "@/cli/commands/focus.tsx";
import HistoryCommand, { options as historyOptions } from "@/cli/commands/history.tsx";
import HomeCommand from "@/cli/commands/index.tsx";
import ReviewCommand from "@/cli/commands/review.tsx";
import ShowCommand, { args as showArgs } from "@/cli/commands/show.tsx";
import StatsCommand from "@/cli/commands/stats.tsx";
import WeakCommand from "@/cli/commands/weak.tsx";
import { reportOptions } from "@/cli/report-options.ts";

type CommandComponent = ComponentType<any>;

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command()
    .name("sat")
    .description("Local-first SAT practice in your terminal")
    .version(packageJson.version, "-v, --version", "Show version number")
    .helpOption("-h, --help", "Show help")
    .action(() => renderCommand(HomeCommand));

  const review = program.command("review").description("Practice eligible missed and corrected questions");
  review.action(() => renderCommand(ReviewCommand));

  const weak = addReportOptions(program.command("weak").description("Rank skills that need the most work"));
  weak.action(() => renderCommand(WeakCommand, parseOptions(reportOptions, weak.opts())));

  const stats = addReportOptions(program.command("stats").description("Show progress, streak, and recent activity"));
  stats.action(() => renderCommand(StatsCommand, parseOptions(reportOptions, stats.opts())));

  const focus = addReportOptions(program.command("focus").description("Show the current question focus"));
  focus.action(() => renderCommand(FocusCommand, parseOptions(reportOptions, focus.opts())));

  const history = addReportOptions(program.command("history").description("Show answered questions"));
  history
    .option("--wrong", "Show currently missed questions", false)
    .option("--corrected", "Show corrected questions", false)
    .option("--limit <count>", "Limit rows", Number.parseFloat)
    .option("--since <when>", "Show rows since an ISO date, 7d, or 2w");
  history.action(() => renderCommand(HistoryCommand, parseOptions(historyOptions, history.opts())));

  const show = program.command("show <id>").description("Inspect a question by ID");
  show.action((id: string) => renderCommand(ShowCommand, {}, parseArguments(showArgs, [id])));

  const config = program.command("config").description("Show local preferences");
  config.action(() => renderCommand(ConfigCommand));

  const set = config.command("set").description("Update local preferences");
  set
    .option("--minimum-days <days>", "Days before a question can be reviewed", Number.parseFloat)
    .option("--minimum-answers-after <count>", "Later answers required before review", Number.parseFloat)
    .option("--result-detail <level>", "Set answer-result detail");
  set.action(() => renderCommand(SetConfigCommand, parseOptions(setConfigOptions, set.opts())));

  const reset = config.command("reset").description("Restore default preferences");
  reset.action(() => renderCommand(ResetConfigCommand));

  await program.parseAsync(argv);
}

function addReportOptions(command: Command): Command {
  return command
    .option("--plain", "Use a compact plain-text layout", false)
    .option("--json", "Output machine-readable JSON", false)
    .option("--no-color", "Disable ANSI color");
}

function parseOptions<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(result.error.issues[0]?.message ?? "Invalid command options");
}

function parseArguments<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(result.error.issues[0]?.message ?? "Invalid command arguments");
}

function renderCommand(Component: CommandComponent, options: unknown = {}, args: unknown[] = []): void {
  render(<CommandApp Component={Component} commandProps={{ options, args }} />);
}
