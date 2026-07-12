import { describe, expect, test } from "bun:test";
import { hasHtmlTable, htmlToText, parseHtmlSegments } from "@/text/html.ts";
import { wrapSegments, wrapText } from "@/text/wrap.ts";
import { questionContentLayout } from "@/tui/components/question-content.tsx";

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

  test("normalizes SAT blank markers", () => {
    expect(htmlToText("<p>The answer is ______blank because of the data.</p>")).toBe(
      "The answer is _______ because of the data.",
    );
  });

  test("wraps text without dropping words", () => {
    expect(wrapText("one two three four", 8)).toEqual(["one two", "three", "four"]);
  });

  test("wraps ansi-styled wide characters by display width", () => {
    const lines = wrapText("\x1b[31m猫猫\x1b[0m sat", 4);
    expect(lines).toEqual(["\x1b[31m猫猫\x1b[0m", "sat"]);
    expect(lines.map((line) => Bun.stringWidth(line))).toEqual([4, 3]);
  });

  test("preserves underline segments from u tags", () => {
    const segments = parseHtmlSegments("<p>Before <u>underlined claim</u> after.</p>");
    expect(segments.some((segment) => segment.style.underline && segment.text.includes("underlined claim"))).toBe(true);
    expect(htmlToText("<p>Before <u>underlined claim</u> after.</p>")).toBe("Before underlined claim after.");
  });

  test("normalizes API blank spans in parsed segments", () => {
    const html =
      '<p>The answer is <span aria-hidden="true">______</span><span class="sr-only">blank</span> because of the data.</p>';
    const text = parseHtmlSegments(html)
      .map((segment) => segment.text)
      .join("")
      .trim();
    expect(text).toBe("The answer is _______ because of the data.");
  });

  test("wraps styled segments without losing underline spans", () => {
    const segments = parseHtmlSegments("<u>This insightful depiction of a preteen girl</u>");
    const lines = wrapSegments(segments, 20);
    expect(lines.flat().some((segment) => segment.style.underline)).toBe(true);
  });

  test("keeps underlined evidence styled in the question viewport", () => {
    const lines = questionContentLayout({
      id: "underlined",
      sourceId: "source-underlined",
      difficulty: "M",
      domain: "CAS",
      skill: "CTC",
      passage: "<p>Text 1: <u>Hull's interpretation is incomplete.</u></p><p>Text 2: New evidence.</p>",
      prompt: "<p>How would Hull's team respond?</p>",
      choices: [],
      correctAnswers: [],
    }, 40);

    expect(lines.flat().some((segment) => segment.style.underline && segment.text.includes("Hull's interpretation"))).toBe(true);
  });

  test("collapses spacer paragraphs and decodes accented entities in dual-text stimuli", () => {
    const html = `<p><strong><span role="heading">Text 1</span></strong></p>
<p>the object that struck the Yucat&aacute;n Peninsula</p>
<p>&nbsp;</p>
<p><strong><span role="heading">Text 2</span></strong></p>
<p>Artemieva argues that an asteroid is plausible.</p>`;
    const lines = wrapSegments(parseHtmlSegments(html), 40).map((line) => line.map((segment) => segment.text).join(""));
    const blankLines = lines.filter((line) => !line.trim()).length;
    expect(blankLines).toBeLessThanOrEqual(2);
    expect(lines.join("\n")).toContain("Yucatán");
    expect(lines.join("\n")).not.toContain("&aacute;");
  });
});
