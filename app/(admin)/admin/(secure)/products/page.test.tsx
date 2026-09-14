// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { adminProducts } from "@/lib/admin-products";
import AdminIndexPage from "../../page";
import ProductFoundation from "../[product]/page";
import WebsiteEntry from "../deutschmit/page";
import { DeutschmitNavigation } from "../deutschmit/analytics-ui";
import AdminProductsPage from "./page";

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("404"); }), redirect: vi.fn(() => { throw new Error("redirect"); }) }));
afterEach(() => vi.clearAllMocks());

it("redirects the admin entry to the picker", () => {
  expect(AdminIndexPage).toThrow("redirect");
  expect(redirect).toHaveBeenCalledWith("/admin/products");
});
it("links every registered product without a backend dependency", () => {
  const html = renderToStaticMarkup(<AdminProductsPage />);
  for (const product of adminProducts) {
    expect(html).toContain(`href="${product.href}"`);
    expect(html).toContain(product.label);
  }
  expect(html.match(/Джерело не підключено/g)).toHaveLength(1);
});
it("keeps website analytics and requests reachable", async () => {
  expect(WebsiteEntry).toThrow("redirect");
  expect(redirect).toHaveBeenCalledWith("/admin/deutschmit/overview");
  await expect(ProductFoundation({ params: Promise.resolve({ product: "deutschmit" }) })).rejects.toThrow("404");
  const html = renderToStaticMarkup(<DeutschmitNavigation active="overview" />);
  expect(html).toContain('href="/admin/dashboard"');
  expect(html).toContain('href="/admin/deutschmit/requests"');
});
it("rejects unknown products", async () => {
  await expect(ProductFoundation({ params: Promise.resolve({ product: "foreign" }) })).rejects.toThrow("404");
  expect(notFound).toHaveBeenCalledOnce();
});
