import { describe, expect, test } from "bun:test";
import { normalizeFocus, selectedDomains, toggleDomain, toggleSkill } from "../src/questions/focus.ts";
import { nextQuestion } from "../src/questions/local-bank.ts";

describe("question selection", () => {
  test("derives domains from selected skills instead of storing two sources of truth", () => {
    const focus = normalizeFocus({ difficulties: ["H"], skills: ["WIC", "BOU"] });

    expect(selectedDomains(focus)).toEqual(["CAS", "SEC"]);
    expect(toggleSkill(focus, "WIC").skills).toEqual(["BOU"]);
    expect(toggleDomain(focus, "CAS").skills).toEqual(["WIC", "TSP", "CTC", "BOU"]);
  });

  test("normalizes the old domain-only focus without leaking it into the model", () => {
    expect(normalizeFocus({ difficulties: ["E"], domains: ["EOI"] })).toEqual({
      difficulties: ["E"],
      skills: ["SYN", "TRA"],
    });
  });

  test("the bundled offline bank returns a focused, unanswered question", async () => {
    const question = await nextQuestion([], { difficulties: ["H"], skills: ["WIC"] }, () => 0);

    expect(question).toMatchObject({ difficulty: "H", skill: "WIC", domain: "CAS" });
    expect(question?.choices.length).toBeGreaterThan(1);
  });
});
