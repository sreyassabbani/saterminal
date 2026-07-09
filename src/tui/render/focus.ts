import { focusSummary } from "../../focus.ts";
import { Frame, truncate } from "../frame.ts";
import { focusGrid, normalizeFocusGridPosition, type FocusGridColumn, type FocusGridRow } from "../focus-grid.ts";
import { terminalSize } from "../kit.ts";
import type { AppState } from "../types.ts";
import { text } from "./shared.ts";

export function renderFocus(doc: Frame, state: AppState): void {
  const { width } = terminalSize();
  const columns = focusGrid(state.focus);
  const position = normalizeFocusGridPosition(columns, { column: state.focusColumn, row: state.focusRow });
  state.focusColumn = position.column;
  state.focusRow = position.row;

  const summary = focusSummary(state.focus);
  text(doc, 0, 3, "study focus", { bold: true });
  text(doc, Math.max(0, width - summary.length - 1), 3, summary, { color: "cyan" });
  text(doc, 0, 4, "Space toggles the selected row. Enter starts practice.", { color: "gray" }, width);
  if (state.notice) {
    text(doc, 0, 5, state.notice, { color: "yellow" }, width);
  }

  renderDifficultyColumn(doc, columns[0], position.column === 0 ? position.row : -1);
  renderDomainColumns(doc, columns.slice(1), position.column - 1, position.row);
}

function renderDifficultyColumn(doc: Frame, column: FocusGridColumn, selectedRow: number): void {
  text(doc, 0, 6, column.title, { color: "cyan", bold: true });

  for (const [index, row] of column.rows.entries()) {
    const output = focusOptionText(row, index === selectedRow);
    writeFocusOption(doc, 0, 7 + index, output, row, index === selectedRow, 32);
  }
}

function renderDomainColumns(doc: Frame, columns: FocusGridColumn[], selectedColumn: number, selectedRow: number): void {
  const { width } = terminalSize();
  const startY = 11;
  const gap = 4;
  const perRow = width >= 112 ? 4 : width >= 72 ? 2 : 1;
  const columnWidth = Math.max(24, Math.floor((width - gap * (perRow - 1)) / perRow));

  for (const [index, column] of columns.entries()) {
    const gridX = index % perRow;
    const gridY = Math.floor(index / perRow);
    const x = gridX * (columnWidth + gap);
    const y = startY + gridY * 7;
    const columnSelected = index === selectedColumn;

    text(doc, x, y, truncate(column.title, columnWidth), { color: "cyan", bold: columnSelected });
    for (const [rowIndex, row] of column.rows.entries()) {
      const focused = columnSelected && rowIndex === selectedRow;
      writeFocusOption(doc, x, y + rowIndex + 1, focusOptionText(row, focused), row, focused, columnWidth);
    }
  }
}

function focusOptionText(row: FocusGridRow, focused: boolean): string {
  const marker = focused ? ">" : " ";
  const checked = row.partial ? "◐" : row.checked ? "●" : "○";
  const indent = row.depth > 0 ? "  " : "";
  return `${marker} ${indent}${checked} ${row.label}`;
}

function writeFocusOption(
  doc: Frame,
  x: number,
  y: number,
  value: string,
  row: FocusGridRow,
  focused: boolean,
  width = terminalSize().width - x,
): void {
  const attr = focused ? { color: "yellow", bold: true } : row.checked || row.partial ? { color: "green" } : { color: "gray" };
  text(doc, x, y, value, attr, width);
}
