# Deploy on Vercel — web and API in two projects, one custom domain

**Branch**: `feat/session-idle-timeout` (continues the delivery work) · **Risk**: item 5 (delivery: deploy
wiring, function entry, build-time migrations)

L1 (user, verbatim): "Ayudame con algo como hago para desplegar este proyecto en Vercel. Dame la directrices"

L2 (user, verbatim): "Como todo esto es gratuito railway solo permite el backend activo por 15 dias. Por lo
que esa opción esta descartada. Vercel es la opción mas solida a nivel gratuito que tengo. Por lo que debemos
trabajar en Vercel"

## Specs

S1. **Both apps live on Vercel**, each as its own project of this monorepo: the web project rooted at
`apps/web` and the API project rooted at `apps/api`. No external process host is part of the delivery.

S2. **The API runs as a Vercel function.** The composition root is split so the Express app can be built
without listening: `createApplication()` returns the app, `main.ts` only adds `listen`. A function entry at
`apps/api/api/index.ts` exports that app, and `apps/api/vercel.json` routes every path to it, so the cookies
keep their `/auth` path.

S3. **Migrations run in the deploy, not in `start`.** Vercel never runs the API's `start` script, so the
migration step moves into the API project's build command, with `DIRECT_URL` present in the build
environment. The failure this prevents is the one that already happened: a model declared but not applied
reaching the runtime as a missing table.

S4. **The API's OpenAPI document travels with the function**, so `/docs` keeps serving the contract instead of
500ing on a file the bundle did not include.

S5. **The session cookies must stay same-site.** `SameSite=Lax` is evaluated per registrable domain, and
`*.vercel.app` is a public suffix, so two default Vercel hostnames are two different sites for the browser.
The deploy therefore requires a custom domain with the web and the API as subdomains of it; the docs state
this, and the env table names `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` as the two values that must match it.

S6. **The documentation describes the new reality.** `docs/stack.md` currently says there is no `vercel.json`
and that nothing applies migrations to a deployed database; both statements stop being true with this
change and are rewritten, including the serverless caveats that remain (per-instance rate limiting, in-memory
counters, cold starts).

## Tasks

| ID | Spec | Route | Commit |
| --- | --- | --- | --- |
| T1 | S2 | Split `main.ts` into `create-application.ts` (composition, no listen) + `main.ts` (listen); add `apps/api/api/index.ts` and `apps/api/vercel.json` with the catch-all rewrite and the `openapi.yaml` include | C1 |
| T2 | S3, S4 | Vercel build command with `prisma migrate deploy`; document `DIRECT_URL` as a build-time variable | C1 |
| T3 | S5, S6 | `docs/stack.md` Vercel section + env table + cookie/same-site warning + remaining serverless caveats; README pointer | C2 |

## Log

L3 (measurement): `apps/api/src/main.ts` ends in `app.listen(...)`, and `buildApp` deliberately does not
listen, so the only missing piece for a function entry is extracting the composition. `apps/api/package.json`
`start` runs `prisma migrate deploy && node dist/main.js`, which Vercel never executes.

L4 (decision): the function entry is `apps/api/api/index.ts` with an extensionless import, kept out of
`tsconfig.check.json`. Reason: this project compiles with NodeNext, which demands a `.js` suffix, while the
bundler Vercel uses for functions resolves the TypeScript file; putting the file in the TS project would
force a suffix the bundler cannot follow. The entry is four lines whose only contract is "export the app".

L6 (review, approved): lineage `review-cdf9233f124be543` reviewed this range with the resilience and
readability lenses and **approved** it; the receipt was acknowledged and burned. Four findings came back as
advisory, and one of them was worth acting on immediately: `R4-preview-migrations` (and its duplicate
`R2-002`) warned that a build command that always migrates turns every preview deployment into a migration
of the shared database. The build now gates on `VERCEL_ENV=production`, so previews neither migrate nor need
`DIRECT_URL`. The remaining advisories (`R2-001` on the composition split, `R4-rewrite-drops-path`, which the
refuter refuted) are informational.

L5 (open, from the review engine): the previous lineage `review-a9440184bf56a3e9` sits at
`provider_refuter_required` for the landing-page range. It was not continued because the human redirected the
work to deployment; the candidate is committed and the lineage stays open rather than being force-closed.
