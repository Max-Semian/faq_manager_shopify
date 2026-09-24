import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

const csp = (url: string) => proxy(new NextRequest(url)).headers.get("Content-Security-Policy");

describe("proxy CSP", () => {
  it("allows framing only by the requesting shop and Shopify admin", () => {
    expect(csp("https://app.test/?shop=demo.myshopify.com")).toBe(
      "frame-ancestors https://demo.myshopify.com https://admin.shopify.com;",
    );
  });

  it("does not trust a non-myshopify shop parameter", () => {
    expect(csp("https://app.test/?shop=evil.example.com")).toBe(
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
    );
  });
});
