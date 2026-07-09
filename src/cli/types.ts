import type { AttemptEvent } from "../types.ts";

export type CliCommand = "history" | "stats" | "focus" | "weak";
export type OutputFormat = "text" | "pretty" | "json";

export type HistoryFilters = {
  wrong?: boolean;
  corrected?: boolean;
  limit?: number;
  since?: string;
};

export type ParsedCli =
  | { kind: "tui" }
  | { kind: "review" }
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "error"; message: string }
  | {
    kind: "command";
    command: CliCommand;
    format: OutputFormat;
    color?: boolean;
    filters?: HistoryFilters;
  };

export type FormatOptions = {
  color?: boolean;
  events?: AttemptEvent[];
  filters?: HistoryFilters;
  now?: Date;
};

export type Style = {
  color: boolean;
};

export type Writable = {
  write(value: string): unknown;
  isTTY?: boolean;
};

export type ActivityDay = {
  date: string;
  count: number;
};

export type ActivityStats = {
  streak: number;
  activeDays: number;
  todayCount: number;
  totalEvents: number;
  days: ActivityDay[];
};

export type WeakRow = {
  skill: string;
  label: string;
  domain: string;
  domainLabel: string;
  total: number;
  mastered: number;
  missed: number;
  accuracy: number;
  avg_seconds: number;
};
