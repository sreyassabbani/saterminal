import { describe, expect, test } from "bun:test";
import { focusRows, toggleFocusRow } from "../src/focus.ts";
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
});
