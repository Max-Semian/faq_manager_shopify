# FAQ Manager

Embedded Shopify admin app for managing FAQ entries stored as `faq_item` metaobjects.
Built with Next.js (App Router), TypeScript, Polaris web components and the Shopify GraphQL Admin API.

- Deployed on Railway: https://faq-manager-production-e47e.up.railway.app (only works inside Shopify Admin).
- Installed on the development store `test-ecorn-sam-nav.myshopify.com` → Apps → FAQ Manager.

## Features

- Table of up to 50 FAQ entries (question, category, active status), most recently updated first.
- Search by question, filter by category and status (client-side).
- Create, edit and delete in a modal, with client + server validation and Shopify `userErrors` mapped to fields.
- Loading, empty, "no matches", validation, success (toast) and API error (banner + retry) states.

## Setup

Requirements: Node.js 20.9+, Shopify CLI, access to the Partner org and development store.

```bash
npm install
cp .env.example .env            # fill in values, see below
shopify app config link         # links shopify.app.toml to the app, fills client_id
shopify app dev                 # runs Next via shopify.web.toml and opens the app in the store admin
```

| Variable | Description |
| --- | --- |
| `SHOPIFY_API_KEY` | App client ID |
| `SHOPIFY_API_SECRET` | App client secret (server only) |
| `SCOPES` | `read_metaobjects,write_metaobjects` |
| `SHOPIFY_APP_URL` | Public app URL, e.g. `https://faq-manager.up.railway.app` |

`shopify app dev` injects these automatically for local development.

### Deploy (Railway)

```bash
railway init                    # or `railway link` to an existing project
railway up                      # build and deploy (config in railway.json)
railway domain                  # generate a public *.up.railway.app URL
railway variables --set SHOPIFY_API_KEY=... --set SHOPIFY_API_SECRET=... \
  --set SCOPES=read_metaobjects,write_metaobjects --set SHOPIFY_APP_URL=https://<domain>
```

Then put the Railway URL into `application_url` / `redirect_urls` in `shopify.app.toml`, run
`shopify app deploy` to release the config (URL + scopes) and install the app on the dev store.

### Scripts

`npm run dev | build | start | lint | typecheck | test`

CI (GitHub Actions) runs lint, typecheck, tests and a production build on every push to `main`.

### Tests

`npm test` runs Vitest:
- `lib/faq.test.ts` — metaobject ⇄ FaqItem mapping, field serialisation, `userErrors` mapping, validation, filters.
- `app/api/faqs/routes.test.ts` — route handlers with Shopify mocked: invalid / missing session token → 401 with
  the App Bridge retry header, misconfiguration → 500, Shopify failures → 401 / 502, validation → 422,
  non-numeric id → 400, refusing to touch metaobjects of other types → 404, create / update / delete happy paths.
- `proxy.test.ts` — CSP `frame-ancestors` only trusts a valid `*.myshopify.com` shop.

## Architecture

```
Shopify Admin (iframe)
 └─ Next.js
     ├─ app/layout.tsx              App Bridge + Polaris from Shopify CDN, <meta shopify-api-key>
     ├─ app/page.tsx                table, search, filters, page states
     ├─ components/FaqModal.tsx     create / edit / delete form
     ├─ app/api/faqs/route.ts       GET list, POST create
     ├─ app/api/faqs/[id]/route.ts  PATCH update, DELETE
     ├─ app/api/health/route.ts     health check for Railway
     ├─ proxy.ts                    CSP frame-ancestors for the embedding shop
     ├─ lib/
     │   ├─ shopify.ts      shopify-api config, session token verification, token exchange
     │   ├─ api.ts          route wrapper: auth + error → HTTP status mapping
     │   ├─ faq.ts          GraphQL operations and metaobject ⇄ FaqItem mapping
     │   ├─ validation.ts   shared zod schema (client and server)
     │   ├─ filter.ts       client-side search / filters
     │   └─ client-api.ts   browser fetch wrapper, waits for App Bridge and adds the session token
     └─ scripts/seed/       GraphQL used to create the faq_item definition and sample entries
```

**Auth.** The client gets a session token from App Bridge (`shopify.idToken()`) and sends it as a Bearer
token. The server verifies it (HS256 signature with the app secret, `exp`/`nbf`, `aud` = API key), takes the
shop from `dest`, and exchanges it for an offline access token (token exchange, managed installation).
Tokens are cached in memory per shop; there is no database, so a cold instance simply exchanges again.

**Data.** `faq_item` is a merchant-owned definition, so it is queried by its plain type. All field values
are strings: `active` is serialised as `"true"`/`"false"`; an empty category is omitted on create and sent as
`""` on update to clear it (verified against the live store: the value becomes `null`). The update and delete
endpoints take a numeric id, rebuild the `gid`, and check that the metaobject is actually a `faq_item` before
writing.

## Notes

- The `faq_item` definition was not present on the development store (`test-ecorn-sam-nav`), so I created it
  to match the spec: merchant-owned, type `faq_item`; `question` single-line required, `answer` multi-line
  required, `category` single-line optional, `active` boolean; no Active-draft status. Sample entries were
  added the same way. The GraphQL used is in `scripts/seed/` (`shopify store` commands need Shopify CLI 3.94+):

  ```bash
  shopify store auth --store <shop>.myshopify.com \
    --scopes read_metaobject_definitions,write_metaobject_definitions,read_metaobjects,write_metaobjects
  shopify store execute --store <shop>.myshopify.com --allow-mutations \
    --query-file scripts/seed/definition.graphql --variable-file scripts/seed/definition.json
  shopify store execute --store <shop>.myshopify.com --allow-mutations --query-file scripts/seed/entries.graphql
  ```

## Limitations

- Only the first 50 entries (by last update) are loaded; no pagination.
- Search and filters work on the loaded 50 entries only.
- No duplicate / bulk actions. Delete is available from the edit modal.
- Access tokens live in memory; fine for one dev store, a real multi-store app needs session storage.

## AI usage

Tool: [Cursor](https://cursor.com) agent (Claude).

Example tasks / prompts given to the agent:
- "Break down the assignment, write an implementation plan split into stages with time estimates."
- "Scaffold a Next.js + TypeScript embedded app with token exchange auth and metaobject CRUD."
- "The create mutation returns 'No metaobject definition exists for type faq_item' — diagnose and seed the definition via Shopify CLI."

Reviewed / changed AI-generated code:
- `@shopify/shopify-api@15` requires Node 22; pinned to `13.1.0` which supports Node 20 and has the same token exchange API.
- First version cast Polaris event targets to `HTMLInputElement`; `@shopify/polaris-types` already types them, so the casts were removed.
- The page was prerendered statically, which would bake the API key in at build time; the layout was made dynamic.
- Initial data loading called `setState` from an effect (flagged by `react-hooks/set-state-in-effect`); rewritten as a promise chain with a stale-response guard.
- App Bridge could load after React hydration (Next injects its scripts before the CDN tag); added a short wait for `shopify.idToken()` with a clear error if the app is opened outside Admin.

How generated code was verified:
- `tsc --strict`, ESLint, production build.
- 26 automated tests (see [Tests](#tests)), including the auth and error paths of every route.
- Manual checks: no token / bad signature / wrong `aud` → 401; CSP header per shop; create / edit / delete against live metaobjects on the development store.
- Read the `@shopify/shopify-api` source to confirm what `decodeSessionToken` validates.
