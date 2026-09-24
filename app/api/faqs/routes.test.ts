import { HttpResponseError, type Session } from "@shopify/shopify-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shopify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify")>();
  return { ...actual, authenticate: vi.fn(), forgetSession: vi.fn() };
});

vi.mock("@/lib/faq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/faq")>();
  return {
    ...actual,
    listFaqs: vi.fn(),
    createFaq: vi.fn(),
    getFaq: vi.fn(),
    updateFaq: vi.fn(),
    deleteFaq: vi.fn(),
  };
});

import * as faq from "@/lib/faq";
import { AuthError, ConfigError, authenticate, forgetSession } from "@/lib/shopify";

import { DELETE, PATCH } from "./[id]/route";
import { GET, POST } from "./route";

const session = { shop: "demo.myshopify.com" } as Session;
const item: faq.FaqItem = {
  id: "gid://shopify/Metaobject/1",
  handle: "shipping",
  question: "How long is shipping?",
  answer: "3-5 days",
  category: "Shipping",
  active: true,
  updatedAt: "2026-09-01T00:00:00Z",
};
const validBody = { question: "Q", answer: "A", category: "", active: true };

const request = (method: string, body?: unknown) =>
  new Request("http://localhost/api/faqs", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticate).mockResolvedValue(session);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("auth and error mapping", () => {
  it("returns 401 with the App Bridge retry header for an invalid session token", async () => {
    vi.mocked(authenticate).mockRejectedValue(new AuthError("Invalid session token"));
    const res = await GET(request("GET"), undefined);
    expect(res.status).toBe(401);
    expect(res.headers.get("X-Shopify-Retry-Invalid-Session-Request")).toBe("1");
    expect(faq.listFaqs).not.toHaveBeenCalled();
  });

  it("returns 500 when the app is misconfigured", async () => {
    vi.mocked(authenticate).mockRejectedValue(new ConfigError("Missing SHOPIFY_API_KEY"));
    expect((await GET(request("GET"), undefined)).status).toBe(500);
  });

  it("drops the cached token and returns 401 when Shopify rejects it", async () => {
    vi.mocked(faq.listFaqs).mockRejectedValue(
      new HttpResponseError({ message: "Unauthorized", code: 401, statusText: "Unauthorized" }),
    );
    const res = await GET(request("GET"), undefined);
    expect(res.status).toBe(401);
    expect(forgetSession).toHaveBeenCalledWith("demo.myshopify.com");
  });

  it("returns 502 for unexpected Shopify failures", async () => {
    vi.mocked(faq.listFaqs).mockRejectedValue(new Error("socket hang up"));
    expect((await GET(request("GET"), undefined)).status).toBe(502);
  });
});

describe("GET /api/faqs", () => {
  it("returns the list", async () => {
    vi.mocked(faq.listFaqs).mockResolvedValue([item]);
    const res = await GET(request("GET"), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [item] });
  });
});

describe("POST /api/faqs", () => {
  it("rejects invalid input before calling Shopify", async () => {
    const res = await POST(request("POST", { question: "", answer: "", category: "", active: true }), undefined);
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors).toMatchObject({
      question: "Question is required",
      answer: "Answer is required",
    });
    expect(faq.createFaq).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/faqs", { method: "POST", body: "{" }), undefined);
    expect(res.status).toBe(422);
  });

  it("passes Shopify userErrors back as field errors", async () => {
    vi.mocked(faq.createFaq).mockResolvedValue({
      ok: false,
      fieldErrors: { question: "Value is too long" },
      formErrors: [],
    });
    const res = await POST(request("POST", validBody), undefined);
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors).toEqual({ question: "Value is too long" });
  });

  it("creates an entry", async () => {
    vi.mocked(faq.createFaq).mockResolvedValue({ ok: true, item });
    const res = await POST(request("POST", validBody), undefined);
    expect(res.status).toBe(201);
    expect(faq.createFaq).toHaveBeenCalledWith(session, validBody);
  });
});

describe("PATCH /api/faqs/[id]", () => {
  it("rejects non-numeric ids", async () => {
    const res = await PATCH(request("PATCH", validBody), ctx("gid://shopify/Product/1"));
    expect(res.status).toBe(400);
    expect(faq.getFaq).not.toHaveBeenCalled();
  });

  it("refuses to update metaobjects that are not faq_item", async () => {
    vi.mocked(faq.getFaq).mockResolvedValue(null);
    const res = await PATCH(request("PATCH", validBody), ctx("42"));
    expect(res.status).toBe(404);
    expect(faq.updateFaq).not.toHaveBeenCalled();
  });

  it("updates an entry by rebuilt gid", async () => {
    vi.mocked(faq.getFaq).mockResolvedValue(item);
    vi.mocked(faq.updateFaq).mockResolvedValue({ ok: true, item });
    const res = await PATCH(request("PATCH", validBody), ctx("1"));
    expect(res.status).toBe(200);
    expect(faq.updateFaq).toHaveBeenCalledWith(session, "gid://shopify/Metaobject/1", validBody);
  });
});

describe("DELETE /api/faqs/[id]", () => {
  it("refuses to delete metaobjects that are not faq_item", async () => {
    vi.mocked(faq.getFaq).mockResolvedValue(null);
    const res = await DELETE(request("DELETE"), ctx("42"));
    expect(res.status).toBe(404);
    expect(faq.deleteFaq).not.toHaveBeenCalled();
  });

  it("surfaces Shopify delete errors", async () => {
    vi.mocked(faq.getFaq).mockResolvedValue(item);
    vi.mocked(faq.deleteFaq).mockResolvedValue({ ok: false, formErrors: ["Record not found"] });
    const res = await DELETE(request("DELETE"), ctx("1"));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Record not found");
  });

  it("deletes an entry", async () => {
    vi.mocked(faq.getFaq).mockResolvedValue(item);
    vi.mocked(faq.deleteFaq).mockResolvedValue({ ok: true });
    const res = await DELETE(request("DELETE"), ctx("1"));
    expect(res.status).toBe(200);
    expect(faq.deleteFaq).toHaveBeenCalledWith(session, "gid://shopify/Metaobject/1");
  });
});
