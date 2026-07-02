import { describe, expect, test } from "bun:test";
import { fetchQuestionBank } from "../src/api.ts";

describe("api", () => {
  test("passes excluded short question ids to the question bank endpoint", async () => {
    const originalFetch = globalThis.fetch;
    let requested = "";
    globalThis.fetch = ((input: RequestInfo | URL) => {
      requested = String(input);
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }) as typeof fetch;

    try {
      await fetchQuestionBank(["a", "b"]);
      expect(requested).toContain("assessment=SAT");
      expect(requested).toContain("excludeIds=a%2Cb");
      expect(requested).toContain("difficulties=M%2CH");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("passes focus filters to the question bank endpoint", async () => {
    const originalFetch = globalThis.fetch;
    let requested = "";
    globalThis.fetch = ((input: RequestInfo | URL) => {
      requested = String(input);
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }) as typeof fetch;

    try {
      await fetchQuestionBank([], {
        difficulties: ["H"],
        domains: ["SEC"],
        skills: ["BOU", "FSS"],
      });
      expect(requested).toContain("difficulties=H");
      expect(requested).toContain("domains=SEC");
      expect(requested).toContain("skills=BOU%2CFSS");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
