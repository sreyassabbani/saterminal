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
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
