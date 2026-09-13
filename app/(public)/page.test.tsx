import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { fetchPublicHomeServerStatsMock } = vi.hoisted(() => ({
  fetchPublicHomeServerStatsMock: vi.fn<
    () => Promise<{
      users: number | null;
      quizzes: number | null;
      isUnavailable: boolean;
    }>
  >(),
}));

vi.mock("./public-home-server-stats", () => ({
  fetchPublicHomeServerStats: fetchPublicHomeServerStatsMock,
}));

import PublicHomePage from "./page";

describe("PublicHomePage", () => {
  it("renders the full homepage with unavailable stats fallback", async () => {
    fetchPublicHomeServerStatsMock.mockResolvedValue({
      users: null,
      quizzes: null,
      isUnavailable: true,
    });

    const html = renderToStaticMarkup(await PublicHomePage());

    expect(fetchPublicHomeServerStatsMock).toHaveBeenCalledOnce();
    expect(html).toContain('id="public-home-root"');
    expect(html).toContain('id="hero"');
    expect(html).toContain('id="quiz-teaser"');
    expect(html).toContain('id="stats"');
    expect(html).toContain('id="projects"');
    expect(html).toContain('id="knowledge"');
    expect(html).toContain('id="unterricht"');
    expect(html).toContain('id="contact"');
    expect(html).toContain("© 2026");
    expect(html.match(/>—</g)).toHaveLength(2);
    expect(html).toContain("Datenabruf derzeit nicht verfügbar");
    expect(html.match(/vorübergehend nicht verfügbar/g)).toHaveLength(2);
  });
});
