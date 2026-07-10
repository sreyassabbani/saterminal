import type { AttemptEvent } from "./attempt.ts";

export type ActivityDay = { date: string; count: number };
export type Activity = {
  streak: number;
  activeDays: number;
  todayCount: number;
  totalAnswers: number;
  days: ActivityDay[];
};

export function activity(events: readonly AttemptEvent[], now = new Date(), dayCount = 84): Activity {
  const counts = new Map<string, number>();
  for (const event of events) {
    const date = new Date(event.answeredAt);
    if (!Number.isNaN(date.getTime())) counts.set(dateKey(date), (counts.get(dateKey(date)) ?? 0) + 1);
  }
  const today = startOfDay(now);
  const days = Array.from({ length: dayCount }, (_, offset) => {
    const date = addDays(today, offset - dayCount + 1);
    const key = dateKey(date);
    return { date: key, count: counts.get(key) ?? 0 };
  });
  return {
    streak: streak(counts, today),
    activeDays: days.filter((day) => day.count > 0).length,
    todayCount: counts.get(dateKey(today)) ?? 0,
    totalAnswers: events.length,
    days,
  };
}

function streak(counts: Map<string, number>, today: Date): number {
  let cursor = counts.get(dateKey(today)) ? today : addDays(today, -1);
  let value = 0;
  while ((counts.get(dateKey(cursor)) ?? 0) > 0) {
    value += 1;
    cursor = addDays(cursor, -1);
  }
  return value;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
