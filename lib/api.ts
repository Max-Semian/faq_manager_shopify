import type { Session } from "@shopify/shopify-api";

import { AuthError, ConfigError, authenticate, forgetSession, isUnauthorizedResponse } from "./shopify";
import type { FieldErrors } from "./validation";

export interface ApiErrorBody {
  error: string;
  fieldErrors?: FieldErrors;
}

export function jsonError(status: number, error: string, fieldErrors?: FieldErrors): Response {
  return Response.json({ error, fieldErrors } satisfies ApiErrorBody, { status });
}

type Handler<Ctx> = (session: Session, request: Request, ctx: Ctx) => Promise<Response>;

export function withSession<Ctx>(handler: Handler<Ctx>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    let session: Session | undefined;
    try {
      session = await authenticate(request);
      return await handler(session, request, ctx);
    } catch (error) {
      if (error instanceof AuthError) {
        // Tells App Bridge to fetch a fresh session token and retry once.
        return Response.json({ error: "Unauthorized" } satisfies ApiErrorBody, {
          status: 401,
          headers: { "X-Shopify-Retry-Invalid-Session-Request": "1" },
        });
      }
      if (error instanceof ConfigError) {
        console.error("[api]", error.message);
        return jsonError(500, "The app is not configured correctly.");
      }
      if (session && isUnauthorizedResponse(error)) {
        forgetSession(session.shop);
        return jsonError(401, "Shopify rejected the access token, reload the app");
      }
      console.error("[api]", error);
      return jsonError(502, "Could not reach Shopify. Please try again.");
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
