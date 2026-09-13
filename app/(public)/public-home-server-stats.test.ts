import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPublicHomeServerStats } from "./public-home-server-stats";

const ORIGINAL_API_INTERNAL_URL = process.env.API_INTERNAL_URL;

function restoreApiInternalUrl() {
  if (ORIGINAL_API_INTERNAL_URL === undefined) {
    delete process.env.API_INTERNAL_URL;
    return;
  }

  process.env.API_INTERNAL_URL = ORIGINAL_API_INTERNAL_URL;
}

beforeEach(() => {
  vi.stubEnv("API_INTERNAL_URL", "http://quiz-arena:8000/");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "/api");
});

afterEach(() => {
  vi.unstubAllEnvs();
  restoreApiInternalUrl();
  vi.unstubAllGlobals();
});

describe("fetchPublicHomeServerStats", () => {
  it("skips the integration when no server URL is configured", async () => {
    vi.stubEnv("API_INTERNAL_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicHomeServerStats()).resolves.toEqual({
      users: null, quizzes: null, isUnavailable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns normalized stats and uses the configured server stats URL", async () => {
    process.env.API_INTERNAL_URL = "http://quiz-arena:8000/";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ users: 1_250, quizzes: 8_840 }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicHomeServerStats()).resolves.toEqual({
      users: 1_250,
      quizzes: 8_840,
      isUnavailable: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://quiz-arena:8000/stats",
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("keeps zero values available as valid numeric stats", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: async () => ({ users: 0, quizzes: 0 }),
      } as Response),
    );

    await expect(fetchPublicHomeServerStats()).resolves.toEqual({
      users: 0,
      quizzes: 0,
      isUnavailable: false,
    });
  });

  it("returns unavailable stats for invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: async (): Promise<unknown> => {
          throw new SyntaxError("Unexpected token");
        },
      } as Response),
    );

    await expect(fetchPublicHomeServerStats()).resolves.toEqual({
      users: null,
      quizzes: null,
      isUnavailable: true,
    });
  });

  it("returns unavailable stats for a schema-invalid payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: async () => ({ users: "1,250", quizzes: 8_840 }),
      } as Response),
    );

    await expect(fetchPublicHomeServerStats()).resolves.toEqual({
      users: null,
      quizzes: null,
      isUnavailable: true,
    });
  });

  it("returns unavailable stats for a non-successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({ ok: false } as Response),
    );

    await expect(fetchPublicHomeServerStats()).resolves.toEqual({
      users: null,
      quizzes: null,
      isUnavailable: true,
    });
  });

  it("returns unavailable stats when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("connection refused")),
    );

    await expect(fetchPublicHomeServerStats()).resolves.toEqual({
      users: null,
      quizzes: null,
      isUnavailable: true,
    });
  });

  it(
    "aborts a never-resolving request and returns unavailable stats within a bounded time",
    async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockImplementation((_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;

            if (signal?.aborted) {
              reject(signal.reason);
              return;
            }

            signal?.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          }),
        ),
      );
      const startedAt = Date.now();

      await expect(fetchPublicHomeServerStats()).resolves.toEqual({
        users: null,
        quizzes: null,
        isUnavailable: true,
      });

      expect(Date.now() - startedAt).toBeLessThan(3_500);
    },
    5_000,
  );
});
