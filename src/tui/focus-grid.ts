import {
  difficultyLabels,
  difficultyOptions,
  domainLabels,
  domainOptions,
  skillsForDomain,
  skillLabels,
  toggleFocusRow,
  type FocusRow,
} from "../focus.ts";
import type { Domain, Focus, Skill } from "../types.ts";

export type FocusGridRow = Extract<FocusRow, { kind: "option" }>;

export type FocusGridColumn = {
  id: "difficulty" | Domain;
  title: string;
  rows: FocusGridRow[];
};

export type FocusGridPosition = {
  column: number;
  row: number;
};

export function focusGrid(focus: Focus): FocusGridColumn[] {
  return [
    {
      id: "difficulty",
      title: "Difficulty",
      rows: difficultyOptions.map((value) => ({
        kind: "option",
        group: "difficulties",
        value,
        label: `${value}  ${difficultyLabels[value]}`,
        checked: focus.difficulties.includes(value),
        depth: 0,
      })),
    },
    ...domainOptions.map((domain) => domainColumn(domain, focus)),
  ];
}

export function normalizeFocusGridPosition(columns: FocusGridColumn[], position: FocusGridPosition): FocusGridPosition {
  const column = clamp(position.column, 0, Math.max(0, columns.length - 1));
  const row = clamp(position.row, 0, Math.max(0, (columns[column]?.rows.length ?? 1) - 1));
  return { column, row };
}

export function moveFocusGridPosition(
  columns: FocusGridColumn[],
  position: FocusGridPosition,
  direction: "up" | "down" | "next" | "previous",
): FocusGridPosition {
  const current = normalizeFocusGridPosition(columns, position);

  if (direction === "up") {
    return { ...current, row: Math.max(0, current.row - 1) };
  }

  if (direction === "down") {
    return { ...current, row: Math.min(columns[current.column].rows.length - 1, current.row + 1) };
  }

  const delta = direction === "previous" ? -1 : 1;
  const column = (current.column + delta + columns.length) % columns.length;
  return normalizeFocusGridPosition(columns, { column, row: current.row });
}

export function selectedFocusGridRow(focus: Focus, position: FocusGridPosition): FocusGridRow {
  const columns = focusGrid(focus);
  const current = normalizeFocusGridPosition(columns, position);
  return columns[current.column].rows[current.row];
}

export function toggleFocusGridRow(focus: Focus, position: FocusGridPosition): Focus {
  return toggleFocusRow(focus, selectedFocusGridRow(focus, position));
}

function domainColumn(domain: Domain, focus: Focus): FocusGridColumn {
  const skills = skillsForDomain(domain);
  const selected = skills.filter((skill) => focus.skills.includes(skill));
  const checked = selected.length > 0;
  const partial = checked && selected.length < skills.length;

  return {
    id: domain,
    title: `${domain}  ${domainLabels[domain]}`,
    rows: [
      {
        kind: "option",
        group: "domains",
        value: domain,
        label: "All skills",
        checked,
        partial,
        depth: 0,
      },
      ...skills.map((skill) => ({
        kind: "option" as const,
        group: "skills" as const,
        value: skill as Skill,
        label: `${skill}  ${skillLabels[skill]}`,
        checked: focus.skills.includes(skill),
        depth: 1,
      })),
    ],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
