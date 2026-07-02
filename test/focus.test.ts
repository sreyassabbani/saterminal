import { describe, expect, test } from "bun:test";
import { focusRows, toggleFocusRow } from "../src/focus.ts";
import { focusGrid, moveFocusGridPosition, toggleFocusGridRow } from "../src/tui/focus-grid.ts";
import type { Focus } from "../src/types.ts";

describe("focus", () => {
  test("renders skills as nested domain children", () => {
    const rows = focusRows({ difficulties: ["H"], domains: ["CAS"], skills: ["WIC"] });
    const cas = rows.find((row) => row.kind === "option" && row.value === "CAS");
    const wic = rows.find((row) => row.kind === "option" && row.value === "WIC");

    expect(cas).toMatchObject({ kind: "option", checked: true, partial: true, depth: 0 });
    expect(wic).toMatchObject({ kind: "option", checked: true, depth: 1 });
  });

  test("domain toggles operate on their child skills", () => {
    const focus: Focus = { difficulties: ["H"], domains: ["CAS"], skills: ["WIC"] };
    const cas = focusRows(focus).find((row) => row.kind === "option" && row.value === "CAS");

    expect(toggleFocusRow(focus, cas)).toEqual({
      difficulties: ["H"],
      domains: ["CAS"],
      skills: ["WIC", "TSP", "CTC"],
    });
  });

  test("grid navigation moves predictably across columns and rows", () => {
    const focus: Focus = { difficulties: ["H"], domains: ["CAS"], skills: ["WIC"] };
    const columns = focusGrid(focus);

    expect(moveFocusGridPosition(columns, { column: 0, row: 1 }, "down")).toEqual({ column: 0, row: 2 });
    expect(moveFocusGridPosition(columns, { column: 0, row: 2 }, "down")).toEqual({ column: 0, row: 2 });
    expect(moveFocusGridPosition(columns, { column: 0, row: 2 }, "next")).toEqual({ column: 1, row: 2 });
    expect(moveFocusGridPosition(columns, { column: 0, row: 2 }, "previous")).toEqual({ column: 4, row: 2 });
  });

  test("grid navigation clamps row when moving into shorter columns", () => {
    const focus: Focus = { difficulties: ["H"], domains: ["INI"], skills: ["CID", "INF", "COE"] };
    const columns = focusGrid(focus);

    expect(moveFocusGridPosition(columns, { column: 1, row: 3 }, "next")).toEqual({ column: 2, row: 3 });
    expect(moveFocusGridPosition(columns, { column: 2, row: 3 }, "next")).toEqual({ column: 3, row: 2 });
  });

  test("grid toggles use focus constraints", () => {
    const focus: Focus = { difficulties: ["H"], domains: ["CAS"], skills: ["WIC"] };

    expect(toggleFocusGridRow(focus, { column: 0, row: 2 })).toBe(focus);
    expect(toggleFocusGridRow(focus, { column: 2, row: 0 })).toEqual({
      difficulties: ["H"],
      domains: ["CAS"],
      skills: ["WIC", "TSP", "CTC"],
    });
  });
});
