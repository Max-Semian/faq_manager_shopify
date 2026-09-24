import { describe, expect, it } from "vitest";

import { mapUserErrors, metaobjectGid, toFaqItem, toFieldInputs, type MetaobjectNode } from "./faq";
import { filterFaqs } from "./filter";
import { validateFaqInput } from "./validation";

const node = (overrides: Partial<MetaobjectNode> = {}): MetaobjectNode => ({
  id: "gid://shopify/Metaobject/1",
  type: "faq_item",
  handle: "shipping",
  updatedAt: "2026-09-01T00:00:00Z",
  question: { value: "How long is shipping?" },
  answer: { value: "3-5 days" },
  category: { value: "Shipping" },
  active: { value: "true" },
  ...overrides,
});

describe("toFaqItem", () => {
  it("maps string field values to typed values", () => {
    expect(toFaqItem(node())).toMatchObject({ category: "Shipping", active: true });
  });

  it("treats missing fields as empty / inactive", () => {
    expect(toFaqItem(node({ category: null, active: { value: "false" } }))).toMatchObject({
      category: null,
      active: false,
    });
    expect(toFaqItem(node({ active: null })).active).toBe(false);
  });
});

describe("toFieldInputs", () => {
  const input = { question: "Q", answer: "A", category: "", active: false };

  it("omits an empty category on create and serialises booleans as strings", () => {
    expect(toFieldInputs(input, "create")).toEqual([
      { key: "question", value: "Q" },
      { key: "answer", value: "A" },
      { key: "active", value: "false" },
    ]);
  });

  it("sends an empty category on update so it gets cleared", () => {
    expect(toFieldInputs(input, "update")).toContainEqual({ key: "category", value: "" });
  });
});

describe("mapUserErrors", () => {
  const fields = toFieldInputs({ question: "Q", answer: "A", category: "C", active: true }, "create");

  it("maps errors by field index and by key, and keeps the rest as form errors", () => {
    const result = mapUserErrors(
      [
        { field: ["metaobject", "fields", "1"], message: "Answer is invalid", code: "INVALID" },
        { field: ["question"], message: "Question is taken", code: "TAKEN" },
        { field: null, message: "Something else", code: null },
      ],
      fields,
    );
    expect(result.fieldErrors).toEqual({ answer: "Answer is invalid", question: "Question is taken" });
    expect(result.formErrors).toEqual(["Something else"]);
  });
});

describe("validateFaqInput", () => {
  it("trims and accepts a valid entry", () => {
    const result = validateFaqInput({ question: "  Q  ", answer: "A", category: "", active: true });
    expect(result).toEqual({ ok: true, value: { question: "Q", answer: "A", category: "", active: true } });
  });

  it("rejects blank required fields and multi-line question", () => {
    expect(validateFaqInput({ question: "   ", answer: "", category: "", active: true })).toMatchObject({
      ok: false,
      fieldErrors: { question: "Question is required", answer: "Answer is required" },
    });
    expect(validateFaqInput({ question: "a\nb", answer: "A", category: "", active: true })).toMatchObject({
      ok: false,
      fieldErrors: { question: "Question must be a single line" },
    });
  });
});

describe("metaobjectGid", () => {
  it("only accepts numeric ids", () => {
    expect(metaobjectGid("42")).toBe("gid://shopify/Metaobject/42");
    expect(metaobjectGid("gid://shopify/Product/42")).toBeNull();
  });
});

describe("filterFaqs", () => {
  const items = [
    toFaqItem(node()),
    toFaqItem(node({ id: "2", question: { value: "Can I return items?" }, category: { value: "Returns" }, active: { value: "false" } })),
  ];

  it("combines search, category and status filters", () => {
    expect(filterFaqs(items, { search: "RETURN", category: "", active: "all" })).toHaveLength(1);
    expect(filterFaqs(items, { search: "", category: "Shipping", active: "inactive" })).toHaveLength(0);
    expect(filterFaqs(items, { search: "", category: "", active: "inactive" })[0]?.id).toBe("2");
  });
});
