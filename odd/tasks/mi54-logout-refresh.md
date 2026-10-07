# MI-54 — Logout real y refresh al cargar la página

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-54 (`To Do`)

## Objetivo

Cerrar el hueco que MI-52 dejó declarado: **el access token vive en memoria**, así que una recarga
limpia de la página no lo tiene y todo lo que depende de él (`/sin-empresas`, la guardia, el switch)
queda inutilizable. MI-54 entrega las dos mitades: **refresh al cargar** (la API puede acuñar un access
token nuevo desde la cookie de refresh) y **logout real** (hoy no existe ni el endpoint ni una sola
llamada en el frontend).

**Criterios**: viven en Jira y **no hay herramientas MCP de Atlassian en esta sesión**. Fuentes locales
que los anticipan: `odd/tasks/auth0-login-approach.md:58` (MI-54 → `POST /auth/logout`, AUTH-03),
`odd/tasks/frontend-data-layer.md:108-109` ("MI-54 define el endpoint de refresh"), y el hueco ya
declarado en `apps/web/src/features/company/components/require-active-company.tsx:33-39`.

## Contexto medido

| Pieza | Estado |
|---|---|
| `POST /auth/login` | ✅ Existe; **setea la cookie** `refresh_token` (`auth-controller.ts:15`, 30 días `:24`, `httpOnly`/`secure`(prod)/`sameSite=lax`/`path` inyectado `:33-39`, `main.ts:43-49` con `path:"/auth"`) |
| `POST /auth/register` | ✅ Existe; **no** setea cookie (`auth-controller.ts:90-95`) |
| `POST /auth/logout` · `POST /auth/refresh` | ❌ **No existen** (`auth-routes.ts:10-16` tiene exactamente login y register) |
| Puerto `IdentityProvider` | ✅ Existe con `exchangePasswordCredentials`; **no** tiene refresh |
| Cliente HTTP (`lib/api/client.ts`) | ✅ `withCredentials` `:119`, attach del bearer `:126-132`, mapeo a `ApiError` `:85-103,135-140`; ❌ **sin interceptor de 401 ni cola de refresh** |
| Store de sesión | ✅ `src/store/session-store/session-store.ts:17-27` con `setSession` y `clear()`; ❌ **nadie llama a `clear()` fuera de tests** |
| Logout en el frontend | ❌ **Cero llamadas**: `grep logout` en `apps/web` no devuelve nada |

## Decisiones de diseño

1. **`POST /auth/refresh`**: lee la cookie `refresh_token` y la intercambia con Auth0 por
   `grant_type=refresh_token` a través del **puerto `IdentityProvider`**, que se extiende con
   `refreshTokens(refreshToken)` (el adaptador ya sabe hablar con el tenant y ya tiene el timeout y el
   mapeo de errores). Responde `200 { accessToken, expiresIn }` — **nunca la respuesta cruda de Auth0**,
   igual que MI-52 — y **rota la cookie** si Auth0 devuelve un refresh token nuevo.
2. **`POST /auth/logout`**: limpia la cookie con los **mismos flags y `path`** y responde `204`. Va
   **sin `requireAuth`** a propósito: un access token vencido no puede impedir cerrar sesión, y el
   endpoint es idempotente.
3. **Errores uniformes**: sin cookie o refresh inválido → **401** con el mismo mensaje (no se distingue
   "no mandaste cookie" de "tu refresh venció": ambos son "volvé a iniciar sesión"), y en el caso
   inválido la API **limpia la cookie** para que el cliente no reintente con basura. Auth0 5xx o red →
   **503**, distinto de 401 (es nuestra infraestructura, no las credenciales), reusando
   `IdentityProviderUnavailableError`.
4. **Sin revocación en Auth0**: invalidar el refresh token emitido exige la Management API, que está
   fuera del alcance. El logout **borra la cookie del navegador**; el token emitido sigue vivo hasta
   vencer. Queda escrito para que no se lea como un olvido.
5. **Rate limit dedicado también en `/auth/refresh`** (mismo criterio que `/auth/login`): sin él, el
   endpoint es un oráculo de tokens. El store compartido sigue siendo **MI-55** y se comenta igual.
6. **Tokens y contraseña nunca se loguean**, tampoco el refresh: ni en el adaptador, ni en el manejador
   de errores, ni en el rate limiter.
7. **Frontend — bootstrap de sesión**: al montar la app se llama a `/auth/refresh` **una sola vez** si no
   hay access token, y se guarda el resultado. Ese es el que hace que una recarga limpia no termine en
   `/login`.
8. **Frontend — interceptor de 401 con cola single-flight**: ante un 401 se intenta **un** refresh y se
   reintenta la request original **una** vez. El propio refresh **nunca** se reintenta (evita el bucle),
   y los 401 concurrentes comparten una única promesa de refresh en vuelo.
9. **La guardia espera la resolución de sesión** antes de decidir: hoy `require-active-company.tsx:33-39`
   manda a `/login` ante un 401 en carga limpia, que es exactamente el caso que el bootstrap arregla.
10. **Logout desde la UI**: hook `useLogout` (llama a la API, limpia el store, redirige a `/login`) y el
    control en el shell. MI-20 lo consume; acá se entrega el hook y su wiring mínimo.

## Unidades de trabajo

- [x] **U1 — API.** ✅ Commit `8c71efc` (`feat(api): refresh the session and log out`). `refreshTokens` en el
  puerto + refresh grant en el adaptador de Auth0 (misma `MINIMAL_SCOPE` con `offline_access` para que el
  proveedor rote, validación de la forma del 200); `RefreshSessionUseCase`; `RefreshTokenRejectedError`
  con mensaje constante; `POST /auth/refresh` con rate limit dedicado y `POST /auth/logout` sin él;
  `refreshSession` **requerido** en `AppDependencies` y cableado en `main.ts` + los 7 call sites de
  `buildApp`; 19 tests nuevos. **Spot check del padre**: 18 suites / 131 tests.
- [ ] **U2 — Frontend (delegada, test-first)**: bootstrap de sesión; interceptor de 401 con cola
  single-flight; `useLogout` + wiring; la guardia espera la resolución; tests con el cliente mockeado.

## Verificación de U1 (independiente, `gentle-ai-verify`)

**7/7 claims PASS, cero defectos, cero bloqueantes.** Gates ejecutados sin enmascarar el exit code:
`bun run test` → 18 suites / 131 tests (exit 0) · `check-types` → exit 0 · `bun run lint` → exit 0 con
**1** warning preexistente en el archivo del usuario. Aritmética del baseline verificada (19 tests nuevos
sobre 112). El RED es creíble: el commit padre no tiene `refresh-session.ts`, ni `refreshTokens`, ni
`AUTH_REFRESH_RATE_LIMIT` (verificado con `git grep` sobre el padre).

Lo que el verificador confirmó leyendo el código, no los títulos de los tests: el 401 uniforme sale de la
misma constante y el mismo mensaje; la cookie se limpia **sólo** en el rechazo (`auth-controller.ts:147-156`)
porque la rama de cookie ausente **retorna antes** (`:120-127`); el 503 es real porque
`IdentityProviderUnavailableError` **no** es `RefreshTokenRejectedError` y lo mapea el manejador compartido;
la respuesta de éxito es literalmente `{accessToken, expiresIn}`; no se rota cookie sin refresh token nuevo;
las dos rutas quedan montadas **antes** del guard de `/companies`; y `main.ts:67` cablea el caso de uso
**real** (los `{} as never` viven sólo en cinco apps de test que nunca piden `/auth/refresh`).

**Tres huecos de cobertura que el verificador marcó (no son defectos)**:
1. La rama de cookie ausente **no tiene test** que afirme la **ausencia** de `Set-Cookie`: hoy sólo se prueba
   leyendo el código.
2. El logout **no se invoca dos veces** en ningún test: la idempotencia está probada por código, no por test.
3. El test del 503 tiene un `expect(status).not.toBe(401)` redundante con el `toBe(503)`.

Los tres se cierran con asserts chicos y quedan anotados como follow-up para el próximo work unit de API
(no se abrió un ciclo de verificación aparte por tres líneas de test).

## Fuera de alcance

Revocación de tokens en Auth0 · "Recordarme" · MI-55 (store compartido del rate limit) · MI-50
(aislamiento por empresa) · el shell y el control visual del logout, que son de MI-20.

## Ruta y presupuesto

**Ruta**: delegada (`gentle-ai-worker`) en dos unidades. Trigger: multi-file write en cada una.
**Test-first**: aplicable en ambos lados (Jest en api y web). **Presupuesto**: ~250–350 líneas por
unidad, dentro del presupuesto de la cadena.

## Bitácora

- 2026-10-07 — Documento creado tras la exploración. Se confirmó que **no existe** ni logout ni refresh,
  que la cookie ya se emite en login, y que el cliente no tiene manejo de 401. Decisiones del usuario:
  orden `MI-54 → MI-50 → MI-20`.
- 2026-10-07 — **U1 hecha y verificada**: commit `8c71efc`, verificación independiente 7/7 PASS sin
  defectos. El worker frenó una vez con `interaction_required` porque el puente de DI (`app.ts`) faltaba en
  las superficies — defecto de planificación del orquestador. Decisión: `refreshSession` **requerido** (no
  opcional) por consistencia con los cuatro casos de uso existentes y para que un olvido de wiring no sea
  un agujero silencioso en un camino de auth; se autorizaron `app.ts` y los 7 call sites de `buildApp`.
  **Aprendizaje del worker**: `check-types` de la API cubre sólo `src/**` y los tests los transpila
  `@swc/jest` sin type-check, así que una dependencia de `buildApp` omitida no falla ahí, sólo en runtime.
