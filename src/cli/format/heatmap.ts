import { addDays, dateKey, monthName, parseDateKey, startOfDay, startOfWeek } from "./time.ts";
import { ansi, paint } from "./style.ts";
import type { ActivityDay, Style } from "../types.ts";

const heatCellGap = " ";
const heatWeekWidth = 2;

export function heatmapLines(days: ActivityDay[], style: Style): string[] {
  if (days.length === 0) {
    return [];
  }

  const first = parseDateKey(days[0]?.date ?? dateKey(new Date()));
  const last = parseDateKey(days[days.length - 1]?.date ?? dateKey(new Date()));
  const start = startOfWeek(first);
  const dayMap = new Map(days.map((day) => [day.date, day.count]));
  const weeks = Math.floor((startOfDay(last).getTime() - start.getTime()) / (7 * 86_400_000)) + 1;
  const labels = ["   ", "Mon", "   ", "Wed", "   ", "Fri", "   "];
  const lines: string[] = [monthLabelLine(start, weeks, first, last)];

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const cells: string[] = [];
    for (let week = 0; week < weeks; week += 1) {
      const date = addDays(start, week * 7 + weekday);
      if (date < first || date > last) {
        cells.push(blankHeatCell());
        continue;
      }
      const count = dayMap.get(dateKey(date)) ?? 0;
      cells.push(heatCell(count, style));
    }
    lines.push(`${labels[weekday]} ${cells.join(heatCellGap)}`.trimEnd());
  }

  return lines;
}

function monthLabelLine(start: Date, weeks: number, first: Date, last: Date): string {
  const columns = Array.from({ length: Math.max(0, weeks * heatWeekWidth - heatCellGap.length) }, () => " ");
  let previousMonth = "";

  for (let week = 0; week < weeks; week += 1) {
    const weekStart = addDays(start, week * 7);
    const weekEnd = addDays(weekStart, 6);
    if (weekEnd < first || weekStart > last) {
      continue;
    }

    const monthKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}`;
    const label = monthKey !== previousMonth ? monthName(weekStart).slice(0, 3) : "";
    const offset = Math.min(week * heatWeekWidth, Math.max(0, columns.length - label.length));
    for (let index = 0; index < label.length && offset + index < columns.length; index += 1) {
      columns[offset + index] = label[index] ?? " ";
    }
    previousMonth = monthKey;
  }

  return `    ${columns.join("")}`.trimEnd();
}

function heatCell(count: number, style: Style): string {
  if (!style.color) {
    return count === 0 ? "□" : "■";
  }

  return paint("■", style, heatColor(count));
}

function blankHeatCell(): string {
  return " ";
}

function heatColor(count: number): string {
  if (count === 0) {
    return ansi.heatEmpty;
  }
  if (count <= 2) {
    return ansi.heatLow;
  }
  if (count <= 4) {
    return ansi.heatMid;
  }
  if (count <= 6) {
    return ansi.heatHigh;
  }
  return ansi.heatMax;
}
