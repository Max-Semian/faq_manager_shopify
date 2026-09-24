import "@shopify/shopify-api/adapters/web-api";
import {
  ApiVersion,
  HttpResponseError,
  RequestedTokenType,
  shopifyApi,
  type Session,
  type Shopify,
} from "@shopify/shopify-api";

export const API_VERSION = ApiVersion.July26;

let api: Shopify | undefined;

export class ConfigError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(`Missing required environment variable ${name}`);
  return value;
}

export function shopify(): Shopify {
  api ??= shopifyApi({
    apiKey: requireEnv("SHOPIFY_API_KEY"),
    apiSecretKey: requireEnv("SHOPIFY_API_SECRET"),
    scopes: requireEnv("SCOPES").split(","),
    hostName: new URL(requireEnv("SHOPIFY_APP_URL")).host,
    apiVersion: API_VERSION,
    isEmbeddedApp: true,
  });
  return api;
}

export class AuthError extends Error {}

// Per-instance cache: on serverless it only lives as long as the warm instance,
// which is fine because any request can re-run the token exchange.
const sessions = new Map<string, Session>();

export async function authenticate(request: Request): Promise<Session> {
  const api = shopify();
  const sessionToken = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!sessionToken) throw new AuthError("Missing session token");

  let dest: string;
  try {
    ({ dest } = await api.session.decodeSessionToken(sessionToken));
  } catch {
    throw new AuthError("Invalid session token");
  }

  const shop = api.utils.sanitizeShop(new URL(dest).hostname);
  if (!shop) throw new AuthError("Invalid shop in session token");

  const cached = sessions.get(shop);
  if (cached?.isActive(api.config.scopes, 60_000)) return cached;

  const { session } = await api.auth.tokenExchange({
    shop,
    sessionToken,
    requestedTokenType: RequestedTokenType.OfflineAccessToken,
    expiring: true,
  });
  sessions.set(shop, session);
  return session;
}

export function forgetSession(shop: string): void {
  sessions.delete(shop);
}

export function adminGraphql(session: Session) {
  return new (shopify().clients.Graphql)({ session });
}

export function isUnauthorizedResponse(error: unknown): boolean {
  return error instanceof HttpResponseError && error.response.code === 401;
}
