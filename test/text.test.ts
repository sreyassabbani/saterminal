import { describe, expect, test } from "bun:test";
import { hasHtmlTable, htmlToText, wrapText } from "../src/text.ts";

describe("text", () => {
  test("converts the API html subset into terminal text", () => {
    expect(htmlToText("<p><strong>Text 1</strong></p><p>Alice&rsquo;s claim&mdash;briefly.</p>")).toBe(
      "Text 1\nAlice's claim-briefly.",
    );
  });

  test("uses media labels instead of leaking svg internals", () => {
    expect(
      htmlToText(
        '<figure><svg aria-label="Line graph titled Exports"><text>90807060</text></svg></figure><p>Read the graph.</p>',
      ),
    ).toBe("[Graph: Line graph titled Exports]\nRead the graph.");
  });

  test("keeps image alt text visible", () => {
    expect(htmlToText('<p><img alt="Triangle ABC" src="/triangle.png"></p>')).toBe("[Image: Triangle ABC]");
  });

  test("detects html tables", () => {
    expect(hasHtmlTable("<p>Text</p>", "<table><tr><td>1</td></tr></table>")).toBe(true);
    expect(hasHtmlTable("<p>Text</p>")).toBe(false);
  });

  test("wraps text without dropping words", () => {
    expect(wrapText("one two three four", 8)).toEqual(["one two", "three", "four"]);
  });
});
