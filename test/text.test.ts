import { describe, expect, test } from "bun:test";
import { htmlToText, wrapText } from "../src/text.ts";

describe("text", () => {
  test("converts the API html subset into terminal text", () => {
    expect(htmlToText("<p><strong>Text 1</strong></p><p>Alice&rsquo;s claim&mdash;briefly.</p>")).toBe(
      "Text 1\nAlice's claim-briefly.",
    );
  });

  test("wraps text without dropping words", () => {
    expect(wrapText("one two three four", 8)).toEqual(["one two", "three", "four"]);
  });
});
