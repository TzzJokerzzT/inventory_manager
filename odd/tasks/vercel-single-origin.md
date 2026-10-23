# Single-origin deploy on Vercel — web and API in one project

**Branch**: `feat/session-idle-timeout` · **Risk**: item 5 (delivery) · **Supersedes**: the two-project
deployment in `odd/tasks/vercel-deployment.md` (kept: it still documents the standalone API)

L1 (user, verbatim): "En estos momentos no tengo dinero para pagar un dominio y subdominio por eso fue
enfatico y dije que esto debe ser gratuito. Ahora sera mejor entonces separar el proyecto y no hacerlo un
monorepo. Es una duda nada de codigo analicemos primero"

L2 (decision, chosen): **A1 — consolidate into one Vercel project with the Express app served as a function**,
after analysing that the repository layout is not the cause and that two free `*.vercel.app` hosts cannot
share a `SameSite=Lax` cookie.

## Specs

S1. **One deployment, one origin.** The web app and the API are served from the same Vercel project and the
same hostname, so every session cookie is first-party and same-origin. No custom domain, no paid plan.

S2. **The API keeps its code.** `createApplication()` and the whole Express app stay as they are; the
single-origin deploy only adds the wiring that mounts them inside Next. The API's 950 tests keep passing
unchanged.

S3. **The public paths stay `/auth/*`, `/companies/*`, `/me`, `/health`, `/docs/*`.** The session cookie is
scoped to `Path=/auth`, so the browser must request `/auth/...`; Next rewrites those prefixes to the API
handler and the handler strips its own prefix before delegating to Express.

S4. **The Express body parser and the framework do not fight.** The API route disables Next's body parser so
`express.json()` reads the raw stream, and it strips the internal prefix from `req.url` so the existing
routes match unchanged.

S5. **Same-origin is stated in the documentation**, including the consequences: the API's secrets now live in
the single project, `WEB_ORIGIN` stays only as a sanity value, CORS stops being load-bearing, and
`NEXT_PUBLIC_API_URL` becomes an origin-relative base.

## Tasks

| ID | Spec | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2, S3, S4 | `apps/web/next.config.js` rewrites + `transpilePackages`; `apps/web/pages/api/[...path].ts` mounting `createApplication()` with the prefix stripped and body parsing off; `api` as a web dependency | C1 |
| T2 | S5 | `docs/stack.md` §5.9 rewritten for the single project, with the env table merged and the two-project option kept as "standalone API" | C2 |

## Log

L3 (analysis): separating into two repositories changes nothing — two Vercel projects are two hosts either
way. `vercel.app` is a public suffix, so the two hosts are different sites and `SameSite=Lax` never travels.
The fallback (`SameSite=None`) needs third-party cookies, which Safari/iOS and Firefox block by default, so
it is not an option for a real user base. Consolidation into one origin is the free fix.

L5 (review): lineage `review-4997a01054c26638` (medium, lenses risk + resilience) went through the refuter
and came back `correction_required` with a single BLOCKER, `R4-EXPRESS-TYPES`, claiming that passing
`NextApiRequest`/`NextApiResponse` to the Express `Application` is a type error and that `next build` cannot
deploy. **The claim is false**, and it was measured instead of obeyed:
- `@types/express` v5 declares the application call signature as
  `(req: Request | http.IncomingMessage, res: Response | http.ServerResponse): any`;
- `NextApiRequest extends http.IncomingMessage` and `NextApiResponse extends http.ServerResponse`, which is
  exactly the accepted shape;
- `bunx tsc --noEmit -p tsconfig.check.json --listFiles` lists `pages/api/[...path].ts` **in the program** and
  the same run reports zero errors with `"strict": true`;
- `bun run build` (next build) exits 0 and prints the route as `ƒ /api/[...path]`.

No code was changed for it: inventing an `as unknown as` cast to satisfy a non-defect would make the handler
worse. The lineage stays open at `correction_required` because the only offered route is a correction for
something the compiler disproves; that needs a provider-side fix or a fresh review, not a code change.

L4 (measurement, why a Pages API route and not a route handler): App Router handlers expose the Web
`Request`/`Response`, so Express would need a `node:http` shim. The Pages Router still exposes Node
`req`/`res`, which is exactly the contract `app(req, res)` expects — zero adapter, zero new dependency.
