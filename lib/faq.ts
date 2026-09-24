import type { Session } from "@shopify/shopify-api";

import { adminGraphql } from "./shopify";
import { FAQ_FIELDS, type FaqField, type FaqInput, type FieldErrors } from "./validation";

export const FAQ_TYPE = "faq_item";
export const FAQ_LIST_LIMIT = 50;

export interface FaqItem {
  id: string;
  handle: string;
  question: string;
  answer: string;
  category: string | null;
  active: boolean;
  updatedAt: string;
}

interface FieldValue {
  value: string | null;
}

export interface MetaobjectNode {
  id: string;
  type: string;
  handle: string;
  updatedAt: string;
  question: FieldValue | null;
  answer: FieldValue | null;
  category: FieldValue | null;
  active: FieldValue | null;
}

export interface MetaobjectUserError {
  field: string[] | null;
  message: string;
  code: string | null;
}

export interface MetaobjectFieldInput {
  key: FaqField;
  value: string;
}

const FAQ_FRAGMENT = /* GraphQL */ `
  fragment FaqFields on Metaobject {
    id
    type
    handle
    updatedAt
    question: field(key: "question") { value }
    answer: field(key: "answer") { value }
    category: field(key: "category") { value }
    active: field(key: "active") { value }
  }
`;

const LIST_QUERY = /* GraphQL */ `
  ${FAQ_FRAGMENT}
  query FaqList($type: String!, $first: Int!) {
    metaobjects(type: $type, first: $first, sortKey: "updated_at", reverse: true) {
      nodes { ...FaqFields }
    }
  }
`;

const GET_QUERY = /* GraphQL */ `
  ${FAQ_FRAGMENT}
  query FaqGet($id: ID!) {
    metaobject(id: $id) { ...FaqFields }
  }
`;

const CREATE_MUTATION = /* GraphQL */ `
  ${FAQ_FRAGMENT}
  mutation FaqCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { ...FaqFields }
      userErrors { field message code }
    }
  }
`;

const UPDATE_MUTATION = /* GraphQL */ `
  ${FAQ_FRAGMENT}
  mutation FaqUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { ...FaqFields }
      userErrors { field message code }
    }
  }
`;

const DELETE_MUTATION = /* GraphQL */ `
  mutation FaqDelete($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors { field message code }
    }
  }
`;

export function toFaqItem(node: MetaobjectNode): FaqItem {
  return {
    id: node.id,
    handle: node.handle,
    question: node.question?.value ?? "",
    answer: node.answer?.value ?? "",
    category: node.category?.value?.trim() || null,
    active: node.active?.value === "true",
    updatedAt: node.updatedAt,
  };
}

/**
 * Metaobject field values are always strings. On create an empty optional
 * field is omitted; on update it is sent as "" so an existing value is cleared.
 */
export function toFieldInputs(input: FaqInput, mode: "create" | "update"): MetaobjectFieldInput[] {
  const fields: MetaobjectFieldInput[] = [
    { key: "question", value: input.question },
    { key: "answer", value: input.answer },
    { key: "active", value: String(input.active) },
  ];
  if (input.category || mode === "update") {
    fields.push({ key: "category", value: input.category });
  }
  return fields;
}

/**
 * userErrors point at the input either by field key or by index into `fields`,
 * e.g. ["metaobject", "fields", "0"]. Anything unmapped becomes a form-level error.
 */
export function mapUserErrors(
  errors: MetaobjectUserError[],
  fields: MetaobjectFieldInput[],
): { fieldErrors: FieldErrors; formErrors: string[] } {
  const fieldErrors: FieldErrors = {};
  const formErrors: string[] = [];

  for (const error of errors) {
    const path = error.field ?? [];
    let key = path.find((p): p is FaqField => (FAQ_FIELDS as string[]).includes(p));
    if (!key) {
      const fieldsAt = path.indexOf("fields");
      const index = fieldsAt >= 0 ? Number(path[fieldsAt + 1]) : NaN;
      key = Number.isInteger(index) ? fields[index]?.key : undefined;
    }
    if (key) fieldErrors[key] ??= error.message;
    else formErrors.push(error.message);
  }
  return { fieldErrors, formErrors };
}

export type MutationResult =
  | { ok: true; item: FaqItem }
  | { ok: false; fieldErrors: FieldErrors; formErrors: string[] };

export async function listFaqs(session: Session): Promise<FaqItem[]> {
  const { data } = await adminGraphql(session).request<{
    metaobjects: { nodes: MetaobjectNode[] };
  }>(LIST_QUERY, { variables: { type: FAQ_TYPE, first: FAQ_LIST_LIMIT } });
  return (data?.metaobjects.nodes ?? []).map(toFaqItem);
}

export async function getFaq(session: Session, id: string): Promise<FaqItem | null> {
  const { data } = await adminGraphql(session).request<{
    metaobject: MetaobjectNode | null;
  }>(GET_QUERY, { variables: { id } });
  const node = data?.metaobject;
  return node && node.type === FAQ_TYPE ? toFaqItem(node) : null;
}

export async function createFaq(session: Session, input: FaqInput): Promise<MutationResult> {
  const fields = toFieldInputs(input, "create");
  const { data } = await adminGraphql(session).request<{
    metaobjectCreate: { metaobject: MetaobjectNode | null; userErrors: MetaobjectUserError[] };
  }>(CREATE_MUTATION, { variables: { metaobject: { type: FAQ_TYPE, fields } } });
  return toMutationResult(data?.metaobjectCreate, fields);
}

export async function updateFaq(
  session: Session,
  id: string,
  input: FaqInput,
): Promise<MutationResult> {
  const fields = toFieldInputs(input, "update");
  const { data } = await adminGraphql(session).request<{
    metaobjectUpdate: { metaobject: MetaobjectNode | null; userErrors: MetaobjectUserError[] };
  }>(UPDATE_MUTATION, { variables: { id, metaobject: { fields } } });
  return toMutationResult(data?.metaobjectUpdate, fields);
}

export type DeleteResult = { ok: true } | { ok: false; formErrors: string[] };

export async function deleteFaq(session: Session, id: string): Promise<DeleteResult> {
  const { data } = await adminGraphql(session).request<{
    metaobjectDelete: { deletedId: string | null; userErrors: MetaobjectUserError[] };
  }>(DELETE_MUTATION, { variables: { id } });

  if (data?.metaobjectDelete.userErrors.length) {
    return { ok: false, formErrors: data.metaobjectDelete.userErrors.map((e) => e.message) };
  }
  if (!data?.metaobjectDelete.deletedId) {
    return { ok: false, formErrors: ["Shopify did not confirm the deletion"] };
  }
  return { ok: true };
}

function toMutationResult(
  payload: { metaobject: MetaobjectNode | null; userErrors: MetaobjectUserError[] } | undefined,
  fields: MetaobjectFieldInput[],
): MutationResult {
  if (payload?.userErrors.length) {
    return { ok: false, ...mapUserErrors(payload.userErrors, fields) };
  }
  if (!payload?.metaobject) {
    return { ok: false, fieldErrors: {}, formErrors: ["Shopify returned no metaobject"] };
  }
  return { ok: true, item: toFaqItem(payload.metaobject) };
}

export function metaobjectGid(numericId: string): string | null {
  return /^\d+$/.test(numericId) ? `gid://shopify/Metaobject/${numericId}` : null;
}
