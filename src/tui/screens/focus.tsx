import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { Focus } from "../../questions/focus.ts";
import { selectedDomains, toggleDifficulty, toggleDomain, toggleSkill } from "../../questions/focus.ts";
import type { Difficulty, DomainCode, SkillCode } from "../../questions/question.ts";
import { difficulties, difficultyLabels, domains, domainLabels, skillLabels, skillsByDomain } from "../../questions/taxonomy.ts";
import { Screen } from "../components/chrome.tsx";

type Column = { id: "difficulty" | DomainCode; rows: ({ kind: "difficulty"; value: Difficulty } | { kind: "domain"; value: DomainCode } | { kind: "skill"; value: SkillCode })[] };

export function FocusScreen({ focus, notice, onChange, onStart }: { focus: Focus; notice?: string; onChange: (focus: Focus) => void; onStart: () => void }) {
  const columns = focusColumns();
  const [position, setPosition] = useState({ column: 0, row: 0 });
  const normalized = { column: Math.min(position.column, columns.length - 1), row: Math.min(position.row, columns[Math.min(position.column, columns.length - 1)].rows.length - 1) };
  useInput((input, key) => {
    if (key.upArrow || input === "k") setPosition((current) => ({ ...current, row: Math.max(0, current.row - 1) }));
    else if (key.downArrow || input === "j") setPosition((current) => ({ ...current, row: Math.min(columns[current.column].rows.length - 1, current.row + 1) }));
    else if (key.tab || key.rightArrow) setPosition((current) => ({ column: (current.column + 1) % columns.length, row: Math.min(current.row, columns[(current.column + 1) % columns.length].rows.length - 1) }));
    else if (key.leftArrow) setPosition((current) => ({ column: (current.column - 1 + columns.length) % columns.length, row: Math.min(current.row, columns[(current.column - 1 + columns.length) % columns.length].rows.length - 1) }));
    else if (input === " ") onChange(toggleRow(focus, columns[normalized.column].rows[normalized.row]));
    else if (key.return) onStart();
  });
  return (
    <Screen title="focus" detail={`${focus.skills.length} skills · ${focus.difficulties.join(",")} · ${selectedDomains(focus).length} domains`} footer="j/k move · tab/←/→ group · space toggle · enter start · q quit">
      {notice ? <Text color="yellow">{notice}</Text> : null}
      <Box gap={3} flexWrap="wrap">
        {columns.map((column, columnIndex) => (
          <Box key={column.id} flexDirection="column" width={column.id === "difficulty" ? 20 : 28}>
            <Text bold color="cyan">{column.id === "difficulty" ? "Difficulty" : `${column.id}  ${domainLabels[column.id]}`}</Text>
            {column.rows.map((row, rowIndex) => {
              const active = normalized.column === columnIndex && normalized.row === rowIndex;
              const checked = rowChecked(focus, row);
              const label = row.kind === "difficulty" ? `${row.value}  ${difficultyLabels[row.value]}` : row.kind === "domain" ? "All skills" : `${row.value}  ${skillLabels[row.value]}`;
              return <Text key={`${row.kind}-${row.value}`} color={active ? "yellow" : checked ? "green" : "gray"} bold={active}>{active ? ">" : " "} {checked ? "●" : "○"} {row.kind === "skill" ? "  " : ""}{label}</Text>;
            })}
          </Box>
        ))}
      </Box>
    </Screen>
  );
}

function focusColumns(): Column[] {
  return [
    { id: "difficulty", rows: difficulties.map((value) => ({ kind: "difficulty", value })) },
    ...domains.map((domain) => ({ id: domain, rows: [{ kind: "domain" as const, value: domain }, ...skillsByDomain[domain].map((value) => ({ kind: "skill" as const, value }))] })),
  ];
}

function toggleRow(focus: Focus, row: Column["rows"][number]): Focus {
  if (row.kind === "difficulty") return toggleDifficulty(focus, row.value);
  if (row.kind === "domain") return toggleDomain(focus, row.value);
  return toggleSkill(focus, row.value);
}

function rowChecked(focus: Focus, row: Column["rows"][number]): boolean {
  if (row.kind === "difficulty") return focus.difficulties.includes(row.value);
  if (row.kind === "skill") return focus.skills.includes(row.value);
  return skillsByDomain[row.value].every((skill) => focus.skills.includes(skill));
}
