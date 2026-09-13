import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const envKeys = [
  "QUIZ_BANK_API_BASE_URL",
  "QUIZ_BANK_EDGE_API_KEY",
  "QUIZ_BANK_CONSUMER_ID",
  "QUIZ_BANK_CONSUMER_API_KEY",
];

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key];
  }
  vi.restoreAllMocks();
});

describe("quiz teaser proxy route", () => {
  it("bounds a hanging Quiz Bank request and returns the existing unavailable response", async () => {
    process.env.QUIZ_BANK_API_BASE_URL = "https://quiz-bank.example";
    process.env.QUIZ_BANK_EDGE_API_KEY = "edge-secret";
    process.env.QUIZ_BANK_CONSUMER_ID = "website";
    process.env.QUIZ_BANK_CONSUMER_API_KEY = "consumer-secret";

    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const startedAt = Date.now();
    const response = await POST(new Request("http://localhost/api/quiz-teaser/next", { method: "POST" }));

    expect(Date.now() - startedAt).toBeLessThan(6_500);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "quiz_teaser_unavailable" });
  }, 8_000);

  it("fails closed when private Quiz Bank configuration is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/quiz-teaser/next", {
        method: "POST",
        body: JSON.stringify({ answeredQuestionIds: [] }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "quiz_teaser_unavailable" });
  });

  it("proxies through the server route without returning credentials", async () => {
    process.env.QUIZ_BANK_API_BASE_URL = "https://quiz-bank.example";
    process.env.QUIZ_BANK_EDGE_API_KEY = "edge-secret";
    process.env.QUIZ_BANK_CONSUMER_ID = "website";
    process.env.QUIZ_BANK_CONSUMER_API_KEY = "consumer-secret";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          quiz_item: {
            id: "q1",
            question: {
              text: "Was ist richtig?",
            },
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
            feedback: {
              correctAnswerId: "a",
              explanation: "A ist richtig.",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/quiz-teaser/next", {
        method: "POST",
        headers: {
          Cookie: "quiz_teaser_scope=11111111-1111-4111-8111-111111111111",
        },
        body: JSON.stringify({ answeredQuestionIds: ["done"] }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const [upstreamUrl, upstreamInit] = fetchSpy.mock.calls[0];
    const headers = new Headers((upstreamInit as RequestInit).headers);

    expect(upstreamUrl).toBe("https://quiz-bank.example/v1/quiz-items/next");
    expect(headers.get("X-API-Key")).toBe("edge-secret");
    expect(headers.get("X-Consumer-Id")).toBe("website");
    expect(headers.get("X-QuizBank-API-Key")).toBe("consumer-secret");
    expect(headers.get("X-QuizBank-Quota-Key")).toBe(
      "website-quiz-teaser:11111111-1111-4111-8111-111111111111",
    );
    expect((upstreamInit as RequestInit).body).toBe(
      JSON.stringify({ consumer_id: "website", cefr_level: "A2", theme_ids: ["T02"] }),
    );
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("edge-secret");
    expect(JSON.stringify(payload)).not.toContain("consumer-secret");
    expect(payload.question).toMatchObject({
      id: "q1",
      prompt: "Was ist richtig?",
      correctAnswerId: "a",
      explanation: "A ist richtig.",
    });
  });

  it("creates a server-side quota scope cookie when the browser has no existing scope", async () => {
    process.env.QUIZ_BANK_API_BASE_URL = "https://quiz-bank.example";
    process.env.QUIZ_BANK_EDGE_API_KEY = "edge-secret";
    process.env.QUIZ_BANK_CONSUMER_ID = "website";
    process.env.QUIZ_BANK_CONSUMER_API_KEY = "consumer-secret";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          quiz_item: {
            id: "q1",
            question: {
              text: "Was ist richtig?",
            },
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
            feedback: {
              correctAnswerId: "a",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/quiz-teaser/next", {
        method: "POST",
        body: JSON.stringify({ answeredQuestionIds: [] }),
      }),
    );
    const [, upstreamInit] = fetchSpy.mock.calls[0];
    const headers = new Headers((upstreamInit as RequestInit).headers);
    const quotaKey = headers.get("X-QuizBank-Quota-Key");
    const setCookie = response.headers.get("Set-Cookie") ?? "";

    expect(response.status).toBe(200);
    expect(quotaKey).toMatch(
      /^website-quiz-teaser:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(setCookie).toContain("quiz_teaser_scope=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Secure");
    expect(setCookie).not.toContain("edge-secret");
    expect(setCookie).not.toContain("consumer-secret");
  });

  it("replaces a malformed quota scope cookie instead of failing the proxy route", async () => {
    process.env.QUIZ_BANK_API_BASE_URL = "https://quiz-bank.example";
    process.env.QUIZ_BANK_EDGE_API_KEY = "edge-secret";
    process.env.QUIZ_BANK_CONSUMER_ID = "website";
    process.env.QUIZ_BANK_CONSUMER_API_KEY = "consumer-secret";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          quiz_item: {
            id: "q1",
            question: {
              text: "Was ist richtig?",
            },
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
            feedback: {
              correctAnswerId: "a",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/quiz-teaser/next", {
        method: "POST",
        headers: {
          Cookie: "quiz_teaser_scope=%",
        },
        body: JSON.stringify({ answeredQuestionIds: [] }),
      }),
    );
    const [, upstreamInit] = fetchSpy.mock.calls[0];
    const headers = new Headers((upstreamInit as RequestInit).headers);

    expect(response.status).toBe(200);
    expect(headers.get("X-QuizBank-Quota-Key")).toMatch(/^website-quiz-teaser:/);
    expect(response.headers.get("Set-Cookie")).toContain("quiz_teaser_scope=");
  });

  it("maps quota exhaustion to a safe public error without backend details", async () => {
    process.env.QUIZ_BANK_API_BASE_URL = "https://quiz-bank.example";
    process.env.QUIZ_BANK_EDGE_API_KEY = "edge-secret";
    process.env.QUIZ_BANK_CONSUMER_ID = "website";
    process.env.QUIZ_BANK_CONSUMER_API_KEY = "consumer-secret";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ reason_code: "QUOTA_EXCEEDED" }), { status: 429 }),
    );

    const response = await POST(
      new Request("http://localhost/api/quiz-teaser/next", {
        method: "POST",
        body: JSON.stringify({ answeredQuestionIds: ["done"] }),
      }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "quiz_teaser_quota_exceeded" });
  });

  it.each([400, 401, 403, 500])("fails closed for upstream status %s", async (status) => {
    process.env.QUIZ_BANK_API_BASE_URL = "https://quiz-bank.example";
    process.env.QUIZ_BANK_EDGE_API_KEY = "edge-secret";
    process.env.QUIZ_BANK_CONSUMER_ID = "website";
    process.env.QUIZ_BANK_CONSUMER_API_KEY = "consumer-secret";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ reason_code: "UPSTREAM_DETAIL" }), { status }),
    );

    const response = await POST(
      new Request("http://localhost/api/quiz-teaser/next", {
        method: "POST",
        body: JSON.stringify({ answeredQuestionIds: ["done"] }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "quiz_teaser_unavailable" });
  });
});
