import type { AttemptEvent } from "../../types.ts";
import type { ActivityDay, ActivityStats } from "../types.ts";
import { addDays, dateKey, startOfDay } from "../format/time.ts";

export function buildActivityStats(events: AttemptEvent[], now = new Date(), days = 84): ActivityStats {
  const counts = new Map<string, number>();
  for (const event of events) {
    const answered = new Date(event.answered_at);
    if (Number.isNaN(answered.getTime())) {
      continue;
    }
    const key = dateKey(answered);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = startOfDay(now);
  const rangeStart = addDays(today, -(days - 1));
  const activityDays: ActivityDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(rangeStart, offset);
    const key = dateKey(date);
    activityDays.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return {
    streak: streakDays(counts, today),
    activeDays: activityDays.filter((day) => day.count > 0).length,
    todayCount: counts.get(dateKey(today)) ?? 0,
    totalEvents: events.length,
    days: activityDays,
  };
}

export function activityPayload(activity: ActivityStats): Omit<ActivityStats, "days"> & { heatmap: ActivityDay[] } {
  return {
    streak: activity.streak,
    activeDays: activity.activeDays,
    todayCount: activity.todayCount,
    totalEvents: activity.totalEvents,
    heatmap: activity.days,
  };
}

function streakDays(counts: Map<string, number>, today: Date): number {
  if (counts.size === 0) {
    return 0;
  }

  let cursor = startOfDay(today);
  if ((counts.get(dateKey(cursor)) ?? 0) === 0) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while ((counts.get(dateKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}
