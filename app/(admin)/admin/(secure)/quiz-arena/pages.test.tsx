import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("recharts", () => {
  const Empty = () => null;
  return Object.fromEntries(["Cell", "Line", "LineChart", "Pie", "PieChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis", "Area", "AreaChart", "Bar", "BarChart", "CartesianGrid"].map(name => [name, Empty]));
});
import Users from "./users/page";
import Content from "./content/page";
import Economy from "./economy/page";
import System from "./system/page";
import Dashboard from "./dashboard/page";
import { DataFreshness } from "./data-freshness";
beforeEach(() => vi.mocked(useQuery).mockReturnValue({ data: undefined, error: new Error("offline"), isLoading: false, dataUpdatedAt: Date.now() } as never));
describe("failed product queries never render zero cards", () => {
  it.each([Users, Content, Economy, System])("shows an isolated error for %s", Page => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Значення не відображаються");
    expect(html).not.toContain("Stabil");
    expect(html).not.toContain("Gesamtzustand");
  });
  it("keeps the dashboard period control available after a failure", () => {
    const html = renderToStaticMarkup(<Dashboard />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('value="7d"');
    expect(html).toContain('value="30d"');
    expect(html).toContain('value="90d"');
    expect(html).not.toContain("Umsatz in Sternen");
  });
  it("renders an explicit successful empty users result", () => {
    vi.mocked(useQuery).mockReturnValue({ data: { items: [], total: 0, page: 1, pages: 0 }, isLoading: false, dataUpdatedAt: Date.now() } as never);
    const html = renderToStaticMarkup(<Users />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Registrierte Nutzer");
  });
  it("distinguishes unknown source freshness from an old snapshot", () => {
    expect(renderToStaticMarkup(<DataFreshness receivedAt={Date.now()} />)).toContain("свіжість джерела невідома");
    expect(renderToStaticMarkup(<DataFreshness receivedAt={Date.now()} generatedAt="2020-01-01T00:00:00Z" />)).toContain("Застарілі дані");
  });
});
