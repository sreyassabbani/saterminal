import { describe, expect, test } from "bun:test";
import { Frame, FrameRenderer, type FrameOutput, type TextAttr } from "../src/tui/frame.ts";

class RecordingOutput implements FrameOutput {
  ops: string[] = [];

  clear(): void {
    this.ops.push("clear");
  }

  moveTo(x: number, y: number): void {
    this.ops.push(`move:${x},${y}`);
  }

  eraseLineAfter(): void {
    this.ops.push("erase");
  }

  reset(): void {
    this.ops.push("reset");
  }

  write(value: string, attr: TextAttr = {}): void {
    const color = typeof attr.color === "string" ? attr.color : "default";
    const bold = attr.bold ? ":bold" : "";
    this.ops.push(`write:${color}${bold}:${value}`);
  }
}

describe("frame renderer", () => {
  test("clips and truncates writes inside frame bounds", () => {
    const frame = new Frame(6, 2);

    frame.writeText(2, 0, "abcdef", { color: "cyan" }, 4);
    frame.writeText(-1, 1, "xyz", { color: "red" });
    frame.writeText(0, 5, "ignored");

    expect(frame.rowRuns(0)).toEqual([{ x: 2, text: "abc…", attr: { color: "cyan" } }]);
    expect(frame.rowRuns(1)).toEqual([{ x: 0, text: "yz", attr: { color: "red" } }]);
  });

  test("emits no operations when the next frame is unchanged", () => {
    const output = new RecordingOutput();
    const renderer = new FrameRenderer(output);
    const frame = new Frame(10, 3);
    frame.writeText(0, 0, "sat", { bold: true });

    renderer.draw(frame);
    output.ops = [];
    renderer.draw(frame);

    expect(output.ops).toEqual([]);
  });

  test("only repaints rows whose rendered content changed", () => {
    const output = new RecordingOutput();
    const renderer = new FrameRenderer(output);
    const first = new Frame(20, 3);
    first.writeText(0, 0, "sat", { bold: true });
    first.writeText(0, 1, "----------", { color: "gray" });
    renderer.draw(first);

    output.ops = [];
    const second = new Frame(20, 3);
    second.writeText(0, 0, "sat", { bold: true });
    second.writeText(0, 1, "----------", { color: "gray" });
    second.writeText(7, 0, "time 0:02", { color: "gray" });
    renderer.draw(second);

    expect(output.ops).toEqual([
      "move:1,1",
      "reset",
      "erase",
      "move:1,1",
      "write:default:bold:sat",
      "move:8,1",
      "write:gray:time 0:02",
      "reset",
    ]);
  });

  test("clears a row when content is removed", () => {
    const output = new RecordingOutput();
    const renderer = new FrameRenderer(output);
    const first = new Frame(20, 2);
    first.writeText(0, 0, "temporary");
    renderer.draw(first);

    output.ops = [];
    renderer.draw(new Frame(20, 2));

    expect(output.ops).toEqual(["move:1,1", "reset", "erase", "reset"]);
  });
});
