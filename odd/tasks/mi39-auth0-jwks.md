# MI-39 — Configurar Auth0 (tenant + validación JWKS en la API)

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-39 (`To Do` → al cerrar)

## Objetivo

Dejar la **plomería** de identidad: el tenant de Auth0 listo para ROPG y la API validando el JWT
contra el JWKS del tenant. MI-39 **no** implementa endpoints de autenticación ni autorización por
empresa: eso es MI-44 a MI-55 y MI-50.

La decisión de UX ya está tomada (§5.4): **formulario propio mediado por el backend (ROPG)**. Por eso
la aplicación de Auth0 es **Regular Web Application** (confidencial, con `client_secret`) y el
frontend **no** habla con Auth0 — la descripción vieja de MI-39, que dice "aplicación SPA", está
desactualizada y hay que reescribirla.

## Evidencia del tenant (medida 2026-10-06, sólo lecturas)

| Medición | Resultado |
|---|---|
| `GET https://<tenant>/.well-known/jwks.json` | **200**, 2 claves **RS256/RSA** → el tenant existe y el dominio configurado es correcto |
| `GET https://<tenant>/.well-known/openid-configuration` | **200**, el `issuer` coincide con el dominio configurado |
| Variables en `apps/api/.env` | las 5 presentes (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_CONNECTION` = `Username-Password-Authentication`) |
| `apps/api/src/config/env.ts` | ya las lee y valida; los secretos quedan fuera de los mensajes de error |
| `POST /oauth/token` con `grant_type=password` (usuario inexistente) | **403 `unauthorized_client`** — *"Grant type 'password' not allowed for the client."* |
| `express-oauth2-jwt-bearer` en `src/` | **sin una sola línea de uso** (grep, excluyendo el cliente Prisma generado) |

**Lectura del 403**: el tenant rechaza el **grant**, no las credenciales. O sea que la aplicación está
bien creada y el `client_secret` es válido, pero **falta habilitar el grant `Password`**. Eso **no**
bloquea esta tarea (la validación del JWT se prueba contra un JWKS local), pero **sí bloquea MI-52**:
sin ese grant no hay forma de intercambiar credenciales ni de verificar que el `aud` del token sea el
que creemos. Habilitarlo es 1 clic en el dashboard y conviene hacerlo ahora.

## Decisiones del usuario (2026-10-06)

1. **Cómo se testean los endpoints protegidos** (§6.2, decisión abierta): **clave de prueba + JWKS
   local**. Se genera un par RSA de test, se sirve un JWKS local y los tests firman tokens válidos,
   expirados y con otra audiencia. Se elige sobre el stub porque el riesgo real está en la
   configuración (`issuer`/`audience` mal puestos dejan todo en 401 en producción, o aceptan tokens
   de otro tenant), y un stub deja la suite verde sin haber ejercitado nunca esa configuración.
2. **Arrancar MI-39 ahora.**

## Diseño

- **Middleware**: `apps/api/src/interfaces/http/middlewares/require-auth.ts`, exportando una factory
  `createRequireAuth({ issuerBaseURL, audience })` que devuelve el middleware de
  `express-oauth2-jwt-bearer`. La factory existe para que los tests puedan apuntarla a un issuer local
  sin tocar el entorno.
- **Composición**: `main.ts` construye el middleware con `env.auth0.domain` y `env.auth0.audience`
  (mismo lugar donde hoy se eligen las implementaciones concretas).
- **Aplicación**: `/health` queda **público**; `POST /companies` y `GET /companies` pasan a
  **protegidos**. El aislamiento por empresa (`company_id` en cada consulta) es MI-4/MI-50, no esto.
- **401**: no hace falta tocar `error-handler.ts`. `express-oauth2-jwt-bearer` lanza un
  `UnauthorizedError` (de `http-errors`) con `status = 401`, y el handler ya mapea cualquier error con
  `status`/`statusCode` a `{ error: { message } }`. **Verificar** que el `WWW-Authenticate` salga bien
  y que el body sea el esperado; si el handler no alcanza, se ajusta ahí y se documenta por qué.
- **Infraestructura de test**: un servidor mínimo que sirva `/.well-known/jwks.json` **y**
  `/.well-known/openid-configuration` (la librería puede pedir el discovery además del JWKS), con un
  par RSA generado en el propio test (`node:crypto`), y un firmante RS256 para armar los tokens. Si se
  prefiere una librería para firmar, sólo como **devDependency** y justificándolo; **ninguna
  dependencia de runtime nueva**.
- **Tokens que hay que probar**: válido → pasa; **ausente** → 401; **mal formado** → 401; **firmado con
  otra clave** → 401; **expirado** → 401; **`aud` distinto** → 401; **`iss` distinto** → 401.

## Tareas

- [x] **T1 — Middleware `requireAuth`.** ✅ Factory `createRequireAuth({ issuerBaseURL, audience })` en
  `middlewares/require-auth.ts`, inyectada por el seam de dependencias (`AppDependencies.requireAuth`),
  aplicada con `router.use("/companies", requireAuth)` y construida en `main.ts` desde
  `env.auth0.domain`/`env.auth0.audience` (con fail-fast si faltan, mismo criterio que
  `resolveDatabaseUrl`). `/health` sigue público. **Hallazgo del worker, verificado por mí**: la
  librería **sí** setea `WWW-Authenticate` (`this.headers = { 'WWW-Authenticate': 'Bearer realm="api"' }`
  en su `UnauthorizedError`) pero el `errorHandler` no lo reenviaba, así que el 401 salía sin el
  challenge e incumplía RFC 6750. Corregido con **allowlist de ese único header**, no con un passthrough
  genérico de `error.headers`: los errores pueden venir de input no confiable en otros caminos y un
  passthrough sería un vector de header injection. Hay un test de falsificación que lo fija.
  Superficies: `apps/api/src/interfaces/http/middlewares/{require-auth,error-handler}.ts`,
  `apps/api/src/interfaces/http/routes/index.ts`, `apps/api/src/interfaces/http/app.ts`, `apps/api/src/main.ts`.
- [x] **T2 — Infraestructura de test.** ✅ `apps/api/tests/support/local-jwks-issuer.ts`: par RSA generado
  con `node:crypto` en el propio test (sin fixture de clave privada commiteada), servidor HTTP en puerto
  efímero que sirve **discovery + JWKS** con `issuer` coherente, y firmante RS256. **Sin dependencia de
  runtime nueva** (tampoco devDependency: el firmante es a mano).
  Superficies: `apps/api/tests/support/**`.
- [x] **T3 — Tests de los endpoints protegidos.** ✅ 8 tests sobre el middleware **real**: válido,
  ausente, mal formado, firmado con otra clave, expirado, `aud` distinto, `iss` distinto, y `/health`
  público. Más el challenge `WWW-Authenticate` y el test de falsificación del allowlist. El smoke test
  se adaptó a las rutas protegidas (con token válido donde hace falta) **sin debilitar** sus
  aserciones. RED observado: 6 casos fallaban con `Expected: 401, Received: 201`. Suite de api: **43
  tests** (eran 33). Superficies: `apps/api/tests/**`.
- [ ] **T4 — Verificación contra el tenant real.** Con un token **real** no se puede todavía (falta el
  grant `Password` y no hay usuarios); verificar lo verificable: JWKS del tenant alcanzable, `issuer`
  correcto, y que la config de la API (`issuerBaseURL`/`audience`) apunta al tenant real.
- [ ] **T5 — Documentación y Jira.** `docs/stack.md` §5.4/§6.2 (decisión de test resuelta),
  `docs/plan-de-trabajo.md` (decisión #1 resuelta), `README.md`, y **reescribir la descripción de MI-39
  en Jira** (SPA → Regular Web Application, decisión de UX resuelta, evidencia del tenant, y el grant
  pendiente).
- [ ] **T6 — Verificación y cierre.** Gates verdes + verificación independiente si el alcance lo
  justifica + cierre en Jira.

## Fuera de alcance (para no mezclar)

MI-52 a MI-55 (endpoints `POST /auth/*` y rate limiting), MI-50 (resolver `auth0_sub → user_id` y
validar membership por request), MI-44 a MI-49 (flujos de registro, asignación, roles, estado sin
empresas). MI-39 es la plomería: tenant + validación del token.

## Bitácora

- 2026-10-06 — Documento creado. Evidencia del tenant medida (JWKS y discovery OK, grant `Password`
  **no** habilitado). Decisiones: clave de prueba + JWKS local; `/health` público y companies
  protegido.
- 2026-10-06 — **T1–T3 hechas.** El middleware quedó cableado y con 43 tests de api en verde
  (33 → 43), `check-types` y `build` de la raíz verdes. Dos detalles que valen para el futuro:
  1. **`WWW-Authenticate`**: la librería lo setea en su `UnauthorizedError` (y también en sus errores
     400 y 403) y el handler no lo reenviaba. Se arregló con allowlist explícita de ese header.
  2. **`main.ts` ahora falla rápido** si faltan `AUTH0_DOMAIN`/`AUTH0_AUDIENCE`, aunque `env.ts` las
     trate como opcionales fuera de producción: las rutas protegidas no pueden funcionar sin ellas, y
     el mensaje nombra las variables sin imprimir valores.
- 2026-10-06 — **Trabajo en paralelo detectado en el worktree**: el usuario está construyendo la vista
  de registro (`apps/web/app/registro/`, `apps/web/src/features/register/`,
  `apps/web/src/view/Auth/`) y esos archivos están **sin commitear y sin importar todavía**. Los gates
  de la raíz están verdes **con ese WIP presente**. Regla: **no** barrerlos en `git add -A` y no
  tocarlos; los commits de esta tarea se arman con rutas explícitas.
