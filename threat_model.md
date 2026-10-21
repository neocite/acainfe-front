# Threat Model

## Project Overview

açaínfe is a Node.js/Express + React (Vite) single-origin web app that helps Brazilian
micro-businesses issue NFS-e (fiscal invoices) for sales made via AbacatePay/Hotmart.
Authentication is handled by Clerk (managed, same-origin session cookies, proxied via
`/api/__clerk`). The app itself holds almost no business data: companies, certificates,
contacts, balances, products, billing, and MCP keys all live in an **external API**
(`ACAINFE_API_URL`). The Express server is primarily a **thin authenticated proxy**:
it validates the Clerk session, derives a stable `x-user-id` from verified session
claims, and forwards allow-listed `/api/app/*` routes upstream with a shared
`ACAINFE_APP_KEY`. Deployed publicly on Replit Autoscale at https://acainfe.com.

## Assets

- **User sessions / identity** — Clerk session cookies and the derived `x-user-id`
  (migrated accounts keep original subject id). Compromise allows acting as a user upstream.
- **A1 digital certificates (PKCS#12) + passwords** — uploaded during onboarding, held
  only in memory and forwarded upstream; never written to disk. These are the fiscal
  signing identity of a company (CNPJ).
- **Application secrets** — `ACAINFE_APP_KEY` (upstream master key), `CLERK_SECRET_KEY`,
  `ACAINFE_API_URL`. All server-side only.
- **Business data (upstream)** — company fiscal settings, invoice history, MCP keys,
  payment-gateway integrations, owner PII (email/WhatsApp/address).

## Trust Boundaries

- **Browser to Express** — all client requests. Same-origin only; no permissive CORS.
  Auth enforced by `requireAuth` on `/api/app`; CSRF on mutating methods via Origin check.
- **Express to external API** — server attaches `x-app-key` + `x-user-id` and proxies.
  **Authorization of objects/tenants is performed upstream, not in this repo.** Object-level
  access control (which user may touch which company/CNPJ) is an upstream responsibility.
- **Express to Clerk** — Clerk Frontend API proxy (production only) and server-side
  session verification.
- **Public vs authenticated** — landing page, `/api/public/pricing`, and OG image are
  public; everything under `/api/app/*` requires a valid Clerk session with a valid email.

## Scan Anchors

- Production entry points: `artifacts/acainfe/server/index.ts` (route wiring, CSRF/origin
  check, rate limit, static serving), `server/middlewares/requireAuth.ts`,
  `server/user-identity.ts`, `server/app-routes.ts` (upstream allow-list),
  `server/app-proxy-request.ts`, `server/middlewares/clerkProxyMiddleware.ts`.
- Highest-risk code area: the certificate onboarding proxy
  (`POST /api/app/onboarding/certificate`) and, more importantly, the **upstream API**
  that owns all tenant/object authorization. Local code cannot enforce cross-tenant
  authorization; weaknesses there surface as upstream findings (files: []).
- Public surfaces: `/`, `/sign-in`, `/sign-up`, `/api/public/pricing`, `/api/og.{svg,png}`.
- Authenticated surfaces: all `/api/app/*` (allow-listed in `app-routes.ts`).
- Dev-only / ignore unless proven reachable: `artifacts/mockup-sandbox` (design artifact,
  preview `/__mockup/`), `tests/`, Vite dev-only branch in `index.ts`.

## Threat Categories

### Spoofing / Improper Authentication

Identity is derived strictly from verified Clerk `sessionClaims` (`identityFromClaims`),
never from browser-supplied identity headers, and never from Clerk's native `auth.userId`.
`requireAuth` fails closed (401) when there is no valid subject + email. Empty `{}` or
blank-email responses are explicitly rejected both server-side and client-side
(`isAuthUser`). Guarantee: every `/api/app/*` request MUST carry a valid Clerk session;
`x-user-id` MUST originate only from verified claims.

### Tampering / CSRF

Mutating requests (non GET/HEAD/OPTIONS) require an `Origin` header matching the app's own
origin, blocking cross-site state change. Private data is same-origin only with no CORS
reflection, so cross-origin reads of GET responses are blocked by the browser. Prices are
sourced server-side from upstream `/v1/public/pricing` with a safe-integer guard. Guarantee:
no permissive CORS with credentials; mutations MUST be same-origin.

### Information Disclosure

No secrets are shipped to the client — only the Clerk **publishable** key (intentionally
public). Upstream errors are mapped to generic 502 messages; no stack traces. Certificates
and passwords are kept in memory and zeroed (`req.file?.buffer.fill(0)`, password deleted)
after proxying. Guarantee: `ACAINFE_APP_KEY`/`CLERK_SECRET_KEY` MUST stay server-side;
responses MUST NOT leak internals.

### Denial of Service

`/api` is rate-limited (90 req/min/IP). Uploads capped at 10 MB, 1 file, 1 field. Upstream
fetches have timeouts (6s pricing, 45s proxy). `trust proxy` set to 1 for correct client IP.

### Elevation of Privilege / Broken Object-Level Authorization

This is the dominant risk. The Express layer only checks *authentication* and an allow-list
of route shapes; it forwards company/CNPJ identifiers to the upstream API, which MUST verify
that the authenticated subject actually owns/belongs to the target tenant for every read and
write. A known CRITICAL finding (existing vuln id 1) demonstrates the upstream accepting a
self-signed A1 certificate and silently joining/overwriting an already-claimed CNPJ tenant,
enabling cross-tenant takeover. Guarantee: upstream MUST validate ICP-Brasil certificate
chains and enforce per-tenant object-level authorization; a mere CNPJ claim MUST NOT grant
ownership of an existing tenant.
