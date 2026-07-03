import { describe, expect, test } from "bun:test";
import { progressBarText } from "../src/progress.ts";

describe("progress", () => {
  test("renders a block progress bar with empty cells", () => {
    expect(progressBarText(0.5, 8)).toBe("████░░░░");
  });

  test("uses partial block cells for fractional progress", () => {
    expect(progressBarText(0.3125, 8)).toBe("██▌░░░░░");
  });

  test("clamps invalid ratios", () => {
    expect(progressBarText(-1, 4)).toBe("░░░░");
    expect(progressBarText(2, 4)).toBe("████");
    expect(progressBarText(Number.NaN, 4)).toBe("░░░░");
  });
});
