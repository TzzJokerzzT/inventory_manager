# Session idle timeout — close the session after inactivity and make the credential unusable

**Branch**: `feat/session-idle-timeout` · **Base**: `origin/development` · **Risk**: item 2 (auth/session guards)
Two windows on purpose: **15 min without interaction in an open tab** closes the session in the client, and
**5 days without any activity** makes the server-side credential unusable, so the person must sign in again.

## Specs

S1. **Client window = 15 minutes.** "15 min para el navegador": after 15 minutes without user interaction
in an open tab the client closes the session: it calls `POST /auth/logout`, clears the in-memory access
token and lands on `/login`. The window is measured from the last interaction (`pointerdown`, `keydown`,
`wheel`, `touchstart`) or from the moment the tab becomes visible again.

S2. **Warning modal before closing.** "Para inactividad que aparezca un modal avisando que la sesión lleva
x tiempo sin actividad en el la pagina y que se cerrara la sesión y que para reactivar que oprima un boton
y vuelva a usar la sesión". Two minutes before the threshold (that is, after 13 minutes idle) a modal opens
showing how long the session has been idle, that it will be closed, and a live countdown to the deadline.
The modal has one action, **Seguir conectado**: pressing it — or dismissing the modal, because interacting
is activity — resets the idle clock, closes the modal and keeps the session alive. If nobody presses it,
S1 fires at 15 minutes.

S3. **Both windows are configurable by environment variable, and the variable is documented.**
- API: `SESSION_IDLE_TIMEOUT_MINUTES`, default `7200` (5 days) — the credential window. Accepts positive
  decimals so a test can use `0.05` (3 s).
- Web: `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES`, default `15` — the browser window. Accepts positive
  decimals for local testing.
The default is what ships; the variable exists so the behaviour can be observed without waiting days.

S4. **The server enforces the 5-day window; the client cannot opt out.** "5 dias para la credencial" and
"Que las credenciales queden inutilizables y tenga que volver a loguearse." `POST /auth/refresh` rejects
with the existing uniform 401 (`{"error":{"message":"Please sign in again"}}`) when the session is unknown,
revoked, or its `last_activity_at` is older than `SESSION_IDLE_TIMEOUT_MINUTES`. The rejection happens
**before** exchanging the refresh token with the identity provider, so an expired session never burns a
rotating refresh token. The 401 clears both session cookies.

S5. **The session is server state, identified by a second httpOnly cookie.** Login creates a `sessions`
row for the authenticated user and sets `session_id` next to `refresh_token` with the same flags the refresh
cookie already uses (`httpOnly`, `secure` in production, `sameSite=lax`, `path=/auth`, same `maxAge`).
`POST /auth/refresh` requires both cookies; on success it moves `last_activity_at` forward. A request with
either cookie missing is the existing uniform 401.

S6. **Logout revokes the credential, not just the cookie.** `POST /auth/logout` marks the session row
`revoked_at` (idempotently: no cookie, unknown id or already revoked all answer the same 204) in addition
to clearing both cookies, so replaying the old cookies against `/auth/refresh` answers 401 and the person
must sign in again. Logout stays outside `requireAuth`: an expired access token must never block it.

S7. **Sessions created before this change are invalidated once.** An old browser holds `refresh_token` but
no `session_id`, so its next `/auth/refresh` answers 401 and the person signs in once. This is stated in
`docs/stack.md`; it is not a silent break.

S8. **Contract and docs move with the behaviour.** `apps/api/openapi.yaml` documents the two cookies, the
new 401 cause and the new endpoints' semantics; `apps/web/lib/api/openapi.d.ts` is regenerated from it;
`SESSION_IDLE_TIMEOUT_MINUTES` and `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES` appear in `.env.example`,
`apps/api/.env.example` and `apps/web/.env.example`; `docs/stack.md` records the `sessions` table and the
two-window rule.

## Tasks

| ID | Spec | Route | Commit |
| --- | --- | --- | --- |
| T1 | S5 (model), S4 (policy), S6 (revocation) | API domain/infrastructure: `Session` entity, `SessionRepository` port, start/resume/end use cases, Prisma + in-memory adapters, hand-written migration, unit tests | C1 |
| T2 | S5, S4, S6 | API HTTP: `session_id` cookie, login/refresh/logout wiring, `env.ts` + `main.ts` + `app.ts`, endpoint tests, `openapi.yaml` + regenerated `openapi.d.ts` | C2 |
| T3 | S3, S8 | docs/config: `.env.example`, `apps/api/.env.example`, `docs/stack.md` | C1–C2 |
| T4 | S1, S3 | Web: `useIdleSession` hook (activity listeners, timers, logout at the threshold), env var, tests | C3 |
| T5 | S2 | Web: `IdleSessionModal` (copy, countdown, "Seguir conectado"), mounted in the provider tree, tests | C3 |
| T6 | all | Verification: `bun run check-types`, `bun run test`, `biome check`, differential check of sibling auth endpoints | — |

### Evidence

- T1: `apps/api/tests/session.test.ts` — 12 tests, green.
- T2: `apps/api/tests/auth-session-idle.test.ts` — 8 tests, green; `bun run test` in `apps/api` → **61 suites / 940 tests green**; `bun run check-types` clean; `bunx biome check apps/api` clean after `--write`.
- T6 differential (probe over the unchanged auth surface, base `origin/development` vs this branch, both run the same supertest probe and the JSON is diffed): identical for `/auth/register`, `/auth/login` 401/403/503 bodies, `/auth/refresh` without cookies (uniform 401) and the 401 on a company route; the only two differences are `/health` `uptime` (wall-clock, not a regression) and `POST /auth/logout` emitting the second cleared cookie (`session_id`), which is exactly S6.

## Log

L1 (user, verbatim): "Pregunta. ¿Se puede implementar un endpoint o metodo en el front que cierre la sesión
por inactividad?. Ya que la sesión no se cierra aun teniendo dias sin entrar en la app o si ya existe esa
funcionalidad"

L2 (user, verbatim): "1. Ventana: 15 min para el navegador, 5 dias para la credencial. Una vez implementado
esto me digas que variable es la que controla ese tiempo para realizar pruebas.
2. Que las credenciales queden inutilizables y tenga que volver a loguearse.

NOTA: Para inactividad que aparezca un modal avisando que la sesión lleva x tiempo sin actividad en el la
pagina y que se cerrara la sesión y que para reactivar que oprima un boton y vuelva a usar la sesión"

L3 (measurement, before the first write): there is no inactivity check today. The refresh cookie lives
30 days and is re-set on every rotation, the access token lives only in memory and is renewed by the 401
interceptor, and `useSessionBootstrap` restores the session on load — so returning after three days opens
the app without credentials. Logout exists but is never time-driven, and it does not invalidate anything
server-side, so it cannot satisfy "credenciales inutilizables".

L4 (decision): the credential window is enforced by our own `sessions` table, not by an Auth0 tenant
setting. Reason: tenant token lifetimes are deploy configuration that this repository cannot test, and the
requirement is that our API refuses the exchange. The Auth0 refresh token itself stays valid provider-side
until its own expiry; what becomes unusable is the only path that can exchange it (our API), which is the
threat boundary a browser client can actually reach.

L5 (measurement, verification): the differential probe of T6 shows one deliberate behaviour change on the
shared auth surface — logout now clears two cookies — and no unrequested change anywhere else.

L6 (blocked): the tool policy refuses to edit `.env.example` files ("Gentle AI safety policy blocked access
to sensitive path"), so `SESSION_IDLE_TIMEOUT_MINUTES` and `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES` are
documented in `docs/stack.md`, the README variable table, `apps/api/src/config/env.ts` and the web hook
instead of the three example files. That needs the human's explicit authorization to finish.
