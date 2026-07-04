import { describe, expect, test } from "bun:test";
import { fetchPracticeSatMetas } from "../src/practice-sat.ts";

describe("practice sat api", () => {
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
      await fetchPracticeSatMetas(["a", "b"]);
      expect(requested).toStartWith("https://practicesat.vercel.app/api/get-questions?");
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
      await fetchPracticeSatMetas([], {
        difficulties: ["H"],
        domains: ["SEC"],
        skills: ["BOU", "FSS"],
      });
      expect(requested).toStartWith("https://practicesat.vercel.app/api/get-questions?");
      expect(requested).toContain("difficulties=H");
      expect(requested).toContain("domains=SEC");
      expect(requested).toContain("skills=BOU%2CFSS");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("derives domain filters from selected skill filters", async () => {
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
      await fetchPracticeSatMetas([], {
        difficulties: ["H"],
        domains: ["INI"],
        skills: ["WIC"],
      });
      expect(requested).toStartWith("https://practicesat.vercel.app/api/get-questions?");
      expect(requested).toContain("domains=CAS");
      expect(requested).toContain("skills=WIC");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("reports non-json API responses with endpoint context", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_input: RequestInfo | URL) =>
      Promise.resolve(
        new Response("Please Migrate to practicesat.vercel.app", {
          status: 200,
          headers: { "content-type": "text/plain;charset=UTF-8" },
        }),
      )) as typeof fetch;

    try {
      await expect(fetchPracticeSatMetas()).rejects.toThrow(
        "Expected JSON from https://practicesat.vercel.app/api/get-questions?",
      );
      await expect(fetchPracticeSatMetas()).rejects.toThrow("Please Migrate to practicesat.vercel.app");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("uses API error messages from json envelopes", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_input: RequestInfo | URL) =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: "Invalid skill codes provided: RHG" }), {
          status: 400,
          statusText: "Bad Request",
          headers: { "content-type": "application/json" },
        }),
      )) as typeof fetch;

    try {
      await expect(fetchPracticeSatMetas()).rejects.toThrow("400 Bad Request: Invalid skill codes provided: RHG");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
