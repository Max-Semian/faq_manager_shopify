import type { ApiErrorBody } from "./api";
import type { FaqItem } from "./faq";
import type { FaqInput, FieldErrors } from "./validation";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

const APP_BRIDGE_TIMEOUT_MS = 10_000;

// Next.js puts its own async chunks before the App Bridge script, so React can
// hydrate before the `shopify` global exists.
async function appBridge(): Promise<typeof globalThis.shopify> {
  const deadline = Date.now() + APP_BRIDGE_TIMEOUT_MS;
  while (typeof globalThis.shopify === "undefined") {
    if (Date.now() > deadline) {
      throw new ApiError("Shopify App Bridge did not load. Open the app from Shopify admin.", 0);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return globalThis.shopify;
}

async function sessionToken(): Promise<string> {
  const bridge = await appBridge();
  try {
    return await bridge.idToken();
  } catch (error) {
    console.error("[app-bridge] idToken failed", error);
    throw new ApiError("Could not get a session token from Shopify. Reload the app.", 0);
  }
}

export async function toast(message: string, isError = false): Promise<void> {
  (await appBridge()).toast.show(message, { isError });
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await sessionToken()}`);
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.", 0);
  }

  const body = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok) {
    throw new ApiError(
      body?.error ?? `Request failed (${response.status})`,
      response.status,
      body?.fieldErrors,
    );
  }
  return body as T;
}

export const faqApi = {
  list: () => apiFetch<{ items: FaqItem[] }>("/api/faqs").then((r) => r.items),

  create: (input: FaqInput) =>
    apiFetch<{ item: FaqItem }>("/api/faqs", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.item),

  update: (id: string, input: FaqInput) =>
    apiFetch<{ item: FaqItem }>(`/api/faqs/${id.split("/").pop()}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((r) => r.item),

  delete: (id: string) =>
    apiFetch<{ ok: true }>(`/api/faqs/${id.split("/").pop()}`, {
      method: "DELETE",
    }),
};
