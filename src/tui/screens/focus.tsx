import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { Focus } from "../../questions/focus.ts";
import { selectedDomains, toggleDifficulty, toggleDomain, toggleSkill } from "../../questions/focus.ts";
import type { Difficulty, DomainCode, SkillCode } from "../../questions/question.ts";
import { difficulties, difficultyLabels, domains, domainLabels, skillLabels, skillsByDomain } from "../../questions/taxonomy.ts";
import { wrapText } from "../../text/wrap.ts";
import { Screen } from "../components/chrome.tsx";
import { useTerminalSize } from "../hooks/use-terminal-size.ts";

type Column = { id: "difficulty" | DomainCode; rows: ({ kind: "difficulty"; value: Difficulty } | { kind: "domain"; value: DomainCode } | { kind: "skill"; value: SkillCode })[] };
type FocusRow = Column["rows"][number];

export function FocusScreen({ focus, notice, onChange, onStart }: { focus: Focus; notice?: string; onChange: (focus: Focus) => void; onStart: () => void }) {
  const { width } = useTerminalSize();
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
    <Screen title="focus" detail={`${focus.skills.length} skills · ${focus.difficulties.join(",")} · ${selectedDomains(focus).length} domains`} footer="j/k move · tab/←/→ group · space toggle · enter start">
      {notice ? <Box marginBottom={1}><Text color="yellow">{notice}</Text></Box> : null}
      <FocusGrid focus={focus} columns={columns} position={normalized} width={width} />
    </Screen>
  );
}

function FocusGrid({ focus, columns, position, width }: { focus: Focus; columns: Column[]; position: { column: number; row: number }; width: number }) {
  const overview = width >= 120;
  const columnGap = overview ? 2 : 0;
  const visibleColumns = overview
    ? columns.map((column, columnIndex) => ({ column, columnIndex }))
    : [{ column: columns[position.column], columnIndex: position.column }];
  const columnWidth = Math.floor((width - columnGap * (visibleColumns.length - 1)) / visibleColumns.length);
  const rowCount = Math.max(...visibleColumns.map(({ column }) => column.rows.length));
  const headerHeight = Math.max(...visibleColumns.map(({ column }) => wrapText(columnLabel(column), columnWidth).length));
  const rowHeights = Array.from({ length: rowCount }, (_, rowIndex) => Math.max(
    ...visibleColumns.map(({ column }) => column.rows[rowIndex]
      ? wrapText(focusLabel(column.rows[rowIndex]), Math.max(1, columnWidth - 4)).length
      : 1),
  ));

  return (
    <Box flexDirection="column">
      <Box columnGap={columnGap}>
        {visibleColumns.map(({ column }) => (
          <Box key={column.id} width={columnWidth} height={headerHeight}>
            <Text bold color="cyan">{columnLabel(column)}</Text>
          </Box>
        ))}
      </Box>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <Box key={rowIndex} columnGap={columnGap}>
          {visibleColumns.map(({ column, columnIndex }) => {
            const row = column.rows[rowIndex];
            if (!row) return <Box key={`${column.id}-${rowIndex}`} width={columnWidth} height={rowHeights[rowIndex]} />;
            const active = position.column === columnIndex && position.row === rowIndex;
            const checked = rowChecked(focus, row);
            const color = active ? "yellow" : checked ? "green" : "gray";
            return (
              <Box key={`${row.kind}-${row.value}`} width={columnWidth} height={rowHeights[rowIndex]}>
                <Box width={4} flexShrink={0}>
                  <Text color={color} bold={active}>{active ? ">" : " "} {checked ? "●" : "○"}</Text>
                </Box>
                <Box width={Math.max(1, columnWidth - 4)}>
                  <Text color={color} bold={active}>{focusLabel(row)}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

function columnLabel(column: Column): string {
  return column.id === "difficulty" ? "Difficulty" : `${column.id}  ${domainLabels[column.id]}`;
}

function focusLabel(row: FocusRow): string {
  if (row.kind === "difficulty") return `${row.value}  ${difficultyLabels[row.value]}`;
  if (row.kind === "domain") return "All skills";
  return `  ${row.value}  ${skillLabels[row.value]}`;
}

function focusColumns(): Column[] {
  return [
    { id: "difficulty", rows: difficulties.map((value) => ({ kind: "difficulty", value })) },
    ...domains.map((domain) => ({ id: domain, rows: [{ kind: "domain" as const, value: domain }, ...skillsByDomain[domain].map((value) => ({ kind: "skill" as const, value }))] })),
  ];
}

function toggleRow(focus: Focus, row: FocusRow): Focus {
  if (row.kind === "difficulty") return toggleDifficulty(focus, row.value);
  if (row.kind === "domain") return toggleDomain(focus, row.value);
  return toggleSkill(focus, row.value);
}

function rowChecked(focus: Focus, row: FocusRow): boolean {
  if (row.kind === "difficulty") return focus.difficulties.includes(row.value);
  if (row.kind === "skill") return focus.skills.includes(row.value);
  return skillsByDomain[row.value].every((skill) => focus.skills.includes(skill));
}
