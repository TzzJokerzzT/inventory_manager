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

## Verificación de U2 (independiente, `gentle-ai-verify`)

**Claims 1-6 PASS**: single-flight real (el test cuenta llamadas en el **adaptador** que maneja el
interceptor real, no en un mock: `refresh-session.test.ts:59-96`); sin bucle y reintento tope-uno
(`client.ts:165-178`, marca propia en `refresh-session.ts:30`); carve-out de auth verificado **por
comportamiento** (`refreshCalls === 0` y store vacío en `use-login.test.tsx:116-151` y
`use-logout.test.tsx:97-128`); la guardia espera (`require-active-company.tsx:25,37-41,60`); el cliente
sigue genérico (sólo importa `axios`); higiene del token (nada en `localStorage`/`sessionStorage`, ningún
log). Sin tests vacíos, sin `.only`/`.skip`. Gates re-ejecutados por el verificador: 33/213, `check-types`
exit 0, lint exit 0 sin warnings.

**Hallazgo real (claim 7)**: el orden de montaje es una **suposición plausible pero no verificada**, y la
rama que cortocircuita (`use-session-bootstrap.ts:24-27`) **nunca construye el cliente** cuando ya hay
token, dejando `onUnauthorized` sin cablear en esa rama. El comentario de `client.ts:199-207`
("therefore the real first caller") **sobreafirma**. Es un defecto latente, no activo — y es lo que
justifica U3.

## Unidades de trabajo

- [x] **U1 — API.** ✅ Commit `8c71efc` (`feat(api): refresh the session and log out`). `refreshTokens` en el
  puerto + refresh grant en el adaptador de Auth0 (misma `MINIMAL_SCOPE` con `offline_access` para que el
  proveedor rote, validación de la forma del 200); `RefreshSessionUseCase`; `RefreshTokenRejectedError`
  con mensaje constante; `POST /auth/refresh` con rate limit dedicado y `POST /auth/logout` sin él;
  `refreshSession` **requerido** en `AppDependencies` y cableado en `main.ts` + los 7 call sites de
  `buildApp`; 19 tests nuevos. **Spot check del padre**: 18 suites / 131 tests.
- [x] **U2 — Frontend.** ✅ Commit `0887be6` (`feat(web): bootstrap the session and log out`). Bootstrap
  de sesión con refresh **single-flight** + `resolved`/`markResolved` en el store; `onUnauthorized`
  inyectado en el cliente (que sigue sin importar features) con interceptor de 401 que refresca una vez
  y reintenta la request original una vez; `useLogout`; la guardia esperando `resolved`; y el **carve-out
  de auth**: login y logout marcan sus propios requests con `skipAuthRefresh`, así un login fallido no
  acuña token. **Spot check del padre**: 33 suites / 213 tests.
- [x] **U3 — Cableado independiente del orden.** ✅ Commit `063adad` (`fix(web): resolve the 401 refresh
  handler lazily`). El cliente guarda el manejador a nivel de módulo (`client.ts:136`), lo registra una
  vez (`setOnUnauthorized`, `client.ts:145-149`) y lo **resuelve por request** dentro del interceptor
  (`client.ts:184`); el feature de auth lo registra **al importar el módulo** (`refresh-session.ts:27`),
  alcanzado sin condición por `Provider` → `SessionBootstrap`. Test de integración nuevo que monta el
  árbol real con un hook de datos y prueba un refresh y un reintento en los dos órdenes. **Spot check del
  padre**: 34 suites / 215 tests.

## Verificación de U3 (independiente, `gentle-ai-verify`)

**7/7 claims PASS, cero defectos.** El verificador re-ejecutó la suite **6 veces** (34/215 cada vez) para
sustanciar el claim de no-flakiness, y contestó la pregunta decisiva: el cliente que el test reusa se
construye **sólo** con `{ getAccessToken }` (`session-refresh.test.tsx:133`), su `options.onUnauthorized`
es `undefined`, y la inyección del adaptador toca `defaults.adapter`, no `options` — así que la única
fuente del manejador es `sharedOnUnauthorized`. **El test prueba el holder, no su propio setup.** Y ambos
tests nuevos **fallan si se revierte** la resolución perezosa: son guardias de regresión reales.

También confirmó que el cliente sigue importando sólo `axios`, que las cinco pruebas previas de 401 siguen
verdes, y que la redundancia de `onUnauthorized` explícito en `refresh-session.ts:35` y `use-logout.ts:29`
es **inofensiva**: ambos pasan la misma función que la registrada, y el request de refresh lleva
`skipAuthRefresh`, así que ese camino nunca se ejecuta.

**Asimetría documentada, sin dependencia viva**: `getAccessToken` **sí** sigue capturándose de las opciones
del primer caller (`client.ts:177`), mientras el manejador ya es perezoso. No es un defecto: los **seis**
callers pasan la misma función, así que no queda dependencia de orden. Queda anotado como deuda de
simetría — si algún día un caller pasara otro getter, el problema volvería.

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
- 2026-10-07 — **U2 hecha y verificada**: commit `0887be6`, verificación independiente con claims 1-6
  PASS. El verificador **encontró un defecto latente** en el séptimo punto: el cableado del refresh
  depende del orden de efectos, no de un contrato. Se abre **U3** con esa evidencia en vez de dar U2 por
  cerrada sin registrar el hueco. Además, el caso borde del login fallido (401 de `/auth/login` disparando
  el refresh y acuñando token) se detectó por el worker y se cerró **antes** del commit, con tests de
  comportamiento en vez de tests de bandera.
- 2026-10-07 — **U3 hecha y verificada** (commit `063adad`, 7/7 PASS): el manejador se resuelve por request
  y se registra al importar el módulo, así que ningún orden puede desactivar el refresh. **MI-54 queda
  completa** (U1 + U2 + U3), las tres verificadas de forma independiente.

## Aprendizaje transversal de MI-54

**"El primero que llame gana" es un contrato roto disfrazado de optimización.** Dos incidentes en el mismo
código: el bug de orden de MI-48 (el `Authorization` dependía de qué página cargaba primero) y este, donde
el refresh del 401 quedaba muerto si cualquier otro caller construía el cliente antes. La regla que queda:
**lo que el interceptor necesita en tiempo de request se resuelve en tiempo de request** — no se captura
en la construcción ni se confía al orden de montaje.
