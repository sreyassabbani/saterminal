import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { Focus } from "@/questions/focus.ts";
import { selectedDomains, toggleDifficulty, toggleDomain, toggleSkill } from "@/questions/focus.ts";
import type { Difficulty, DomainCode, SkillCode } from "@/questions/question.ts";
import { difficulties, difficultyLabels, domains, domainLabels, skillLabels, skillsByDomain } from "@/questions/taxonomy.ts";
import { Screen } from "@/tui/components/chrome.tsx";
import { useTerminalSize } from "@/tui/hooks/use-terminal-size.ts";

type FocusPosition = {
  column: number;
  row: number;
};

type FocusRow =
  | { kind: "difficulty"; value: Difficulty }
  | { kind: "domain"; value: DomainCode }
  | { kind: "skill"; value: SkillCode };

type FocusColumn = {
  id: "difficulty" | DomainCode;
  rows: FocusRow[];
};

type VisibleColumn = {
  column: FocusColumn;
  columnIndex: number;
};

type FocusScreenProps = {
  focus: Focus;
  notice?: string;
  onChange: (focus: Focus) => void;
  onStart: () => void;
};

type FocusGridProps = {
  focus: Focus;
  columns: FocusColumn[];
  position: FocusPosition;
  width: number;
};

type FocusGroupProps = {
  focus: Focus;
  column: FocusColumn;
  columnIndex: number;
  position: FocusPosition;
  width: number;
  compact: boolean;
};

export function FocusScreen({ focus, notice, onChange, onStart }: FocusScreenProps) {
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

function FocusGrid({ focus, columns, position, width }: FocusGridProps) {
  const columnGap = 2;
  const minimumColumnWidth = Math.max(...columns.flatMap((column) => [
    Bun.stringWidth(columnLabel(column)),
    ...column.rows.map((row) => 4 + Bun.stringWidth(focusLabel(row))),
  ]));
  const overviewColumns = Math.min(3, Math.floor((width + columnGap) / (minimumColumnWidth + columnGap)));
  const columnCount = Math.max(1, overviewColumns);
  const visibleColumns: VisibleColumn[] = columnCount > 1
    ? columns.map((column, columnIndex) => ({ column, columnIndex }))
    : [{ column: columns[position.column], columnIndex: position.column }];
  const renderedColumnCount = Math.min(columnCount, visibleColumns.length);
  const columnWidth = Math.floor((width - columnGap * (renderedColumnCount - 1)) / renderedColumnCount);
  const groupRows = chunks(visibleColumns, renderedColumnCount);

  return (
    <Box flexDirection="column">
      {groupRows.map((groupRow, rowIndex) => (
        <Box
          key={groupRow.map(({ column }) => column.id).join("-")}
          columnGap={columnGap}
          marginBottom={rowIndex === groupRows.length - 1 ? 0 : 1}
        >
          {groupRow.map(({ column, columnIndex }) => (
            <FocusGroup
              key={column.id}
              focus={focus}
              column={column}
              columnIndex={columnIndex}
              position={position}
              width={columnWidth}
              compact={columnWidth < minimumColumnWidth}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

function FocusGroup({ focus, column, columnIndex, position, width, compact }: FocusGroupProps) {
  return (
    <Box width={width} flexDirection="column">
      <Text bold color="cyan">{columnLabel(column, compact)}</Text>
      {column.rows.map((row, rowIndex) => {
        const active = position.column === columnIndex && position.row === rowIndex;
        const checked = rowChecked(focus, row);
        return (
          <Text key={`${row.kind}-${row.value}`} color={active ? "yellow" : checked ? "green" : "gray"} bold={active}>
            {active ? ">" : " "} {checked ? "●" : "○"} {focusLabel(row, compact)}
          </Text>
        );
      })}
    </Box>
  );
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

function columnLabel(column: FocusColumn, compact = false): string {
  if (column.id === "difficulty") return "Difficulty";
  return compact ? column.id : `${column.id}  ${domainLabels[column.id]}`;
}

function focusLabel(row: FocusRow, compact = false): string {
  if (row.kind === "difficulty") return `${row.value}  ${difficultyLabels[row.value]}`;
  if (row.kind === "domain") return "All skills";
  return compact ? row.value : `  ${row.value}  ${skillLabels[row.value]}`;
}

function focusColumns(): FocusColumn[] {
  return [
    { id: "difficulty", rows: difficulties.map((value) => ({ kind: "difficulty", value })) },
    ...domains.map((domain) => ({
      id: domain,
      rows: [
        { kind: "domain" as const, value: domain },
        ...skillsByDomain[domain].map((value) => ({ kind: "skill" as const, value })),
      ],
    })),
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
