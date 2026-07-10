import type { Attempt } from "./attempt.ts";

export type HistoryFilters = {
  wrong?: boolean;
  corrected?: boolean;
  limit?: number;
  since?: string;
};

export function history(attempts: Iterable<Attempt>, filters: HistoryFilters = {}, now = new Date()): Attempt[] {
  let rows = [...attempts].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
  if (filters.since) {
    const since = parseSince(filters.since, now);
    rows = rows.filter((attempt) => new Date(attempt.answeredAt) >= since);
  }
  if (filters.wrong || filters.corrected) {
    rows = rows.filter((attempt) =>
      (filters.wrong && attempt.outcome === "incorrect") ||
      (filters.corrected && attempt.outcome === "corrected")
    );
  }
  return filters.limit ? rows.slice(0, filters.limit) : rows;
}

export function parseSince(value: string, now = new Date()): Date {
  const relative = /^(\d+)(d|w)$/.exec(value);
  if (relative) {
    const amount = Number(relative[1]) * (relative[2] === "w" ? 7 : 1);
    return new Date(now.getTime() - amount * 86_400_000);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}
