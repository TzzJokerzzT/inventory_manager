# Feature: Endpoint `GET /me`

**Estado:** completado — 2 work-unit commits, gate raíz verde
**Fuente:** pedido del usuario (2026-10-09): "Implementa un endpoint `/me` para obtener la información del usuario". Sin issue de Jira asociado.
**Requerimientos:** `docs/stack.md` §3.1 (aislamiento por código es el mayor riesgo de seguridad), §5.8 (matriz de autorización), §6.2
**Rama:** `feat/login-register-backend-frontend` (no es la default; los work-unit commits van acá)

## Objetivo

Exponer `GET /me`: una sola llamada autenticada que devuelve la identidad del usuario y sus
membresías activas con la empresa y el rol, para que el cliente pueda bootstrapear la sesión sin
encadenar `/companies` + `/companies/{companyId}/context` por empresa.

## Alcance

- ✅ **Dentro:** `apps/api` (dominio, aplicación, HTTP, OpenAPI, tests) y la tabla de endpoints del
  `README.md`.
- ❌ **Fuera de esta tarea por decisión del orquestador (no del usuario):** cablear el front. No existe hoy
  ningún consumidor de datos de usuario (el session store guarda sólo `accessToken`), así que no hay nada
  que consumir: es una tarea aparte. Además el humano tiene trabajo sin commitear en `apps/web`
  (`app/page.tsx`, `src/layout/app-shell.tsx`) y no se le pisa el árbol.
  **Excepción pendiente de autorización:** `apps/web/lib/api/openapi.d.ts` es un artefacto **generado**
  derivado de `apps/api/openapi.yaml` y su guard de deriva ya está rojo por el cambio de spec (ver F1).
  No es trabajo del humano, pero está en `apps/web`: se regenera sólo con autorización explícita.
- ❌ **Fuera:** roles/permisos globales, MFA, datos de perfil que Auth0 no nos dio (nombre, avatar). No
  hay columnas para eso en `users` y agregarlas es otro alcance.
- ❌ **Fuera:** endpoint de actualización (`PATCH /me`) o cualquier superficie de escritura.

## Contrato decidido por el usuario

`GET /me` → **200**, objeto plano (sin envoltorio `{ data }`, como el resto de la API):

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "createdAt": "2026-10-09T12:00:00.000Z",
  "memberships": [
    {
      "companyId": "uuid",
      "role": "OWNER",
      "company": { "id": "uuid", "name": "Acme", "createdAt": "..." }
    }
  ]
}
```

> **Ajuste de fidelidad (lo destapó la verificación):** el ejemplo original de este doc listaba un `taxId`
> en `company`. La entidad `Company.toJSON()` devuelve sólo `{ id, name, createdAt }`
> (`apps/api/src/domain/entities/company.ts:50`), así que no se inventa el campo: `/me` proyecta la misma
> forma que ya proyecta `GET /companies`. El `tax_id` existe en la base
> (`prisma/migrations/20261006223356_init/migration.sql:18`) pero **no** está en la proyección actual,
> y agregarlo acá sería un cambio de contrato aparte.

Errores: **401** sin token válido (lo emite `requireAuth`), **403 `user_not_provisioned`** cuando el
token es válido pero no resuelve a fila en `users` (lo emite `requireUser`), **429**, **500**.

## Decisiones de implementación

1. **`auth0Sub` NO se expone. Nunca.** `User.toJSON()` (`domain/entities/user.ts:66`) lo incluye, así
   que `/me` **no** puede hacer `json(user)`. El subject de Auth0 es identidad interna del proveedor: no
   es un dato del usuario, es una clave de correlación del backend. Se serializa una vista pública
   explícita (`id`, `email`, `createdAt`) y un test lo guarda (falla si la clave reaparece).
2. **Se agrega un read nuevo al port de membresías.** `MembershipRepository` hoy expone sólo
   `findActiveByUserAndCompany`. `/me` necesita las membresías activas **del usuario**, y resolverlo con
   `findAllForUser` + N llamadas a `findActiveByUserAndCompany` sería N+1 queries. Se agrega
   `findActiveByUser(userId)`. **Justificación frente al comentario del port**: ese comentario acota el
   *write surface* fuera de alcance (assign, accept, list members de MI-45/46/47); un read por usuario
   que MI-50 no necesitaba pero `/me` sí es alcance legítimo, y se documenta en el port.
3. **El join vive en el use case, no en el repositorio ni en el controller.** Se cruzan
   `membershipRepository.findActiveByUser(userId)` con `companyRepository.findAllForUser(userId)` por
   `companyId`. Dos queries, sin N+1, y **sin** tocar `CompanyRepository` (su `findAllForUser` alcanza).
   El controller no arma datos: sólo lee `request.user` y delega.
4. **Fail-closed en el join:** una membership sin empresa correspondiente en `findAllForUser` se
   **descarta**. Nunca se emite una empresa que el listado del propio usuario no devolvió; una
   inconsistencia entre las dos queries se resuelve no filtrando nada, no filtrando de más.
5. **`/me` no es company-scoped.** No pasa por `requireCompanyContext`: es un endpoint de identidad, no
   de una empresa. Lleva `requireAuth` + `requireUser`, el mismo par que `/companies`, pero fuera del
   `router.use("/companies", ...)`.
6. **`app.ts` no expone repositorios a `buildApp`** (`AppDependencies` sólo tiene middlewares y use
   cases). El handler lee `request.user`, que `requireUser` ya dejó resuelto: la única dependencia nueva
   es el use case, que se inyecta como todos los demás. No se agrega `userRepository` a `AppDependencies`
   para no ampliar la superficie del composition root sin necesidad.

## Tareas

### U1 — Read de membresías por usuario (port + adaptadores)

- [x] **U1.1** `domain/repositories/membership-repository.ts`: `findActiveByUser(userId: string): Promise<Membership[]>`,
      documentando (a) que sólo devuelve `ACTIVE` y (b) por qué es un read legítimo pese al comentario
      de alcance del port.
- [x] **U1.2** `infrastructure/database/in-memory-membership-repository.ts`: implementación filtrando por
      `userId` y `status === "ACTIVE"`.
- [x] **U1.3** `infrastructure/database/prisma-membership-repository.ts`: implementación contra Prisma con
      el mismo filtro.
- [x] **U1.4** Tests: extender `tests/in-memory-membership-repository.test.ts` y
      `tests/prisma-membership-repository.test.ts`. Cubrir: usuario con 2 activas devuelve 2; `INVITED` y
      `REVOKED` no aparecen; usuario sin membresías devuelve `[]`; **no** se devuelven membresías de otro
      usuario.

### U2 — Use case `GetCurrentUserUseCase`

- [x] **U2.1** `application/use-cases/get-current-user.ts` con el patrón de `list-companies.ts`
      (clase + `interface ...Dependencies` + `execute`).
- [x] **U2.2** `execute(user: User)` devuelve `{ user: { id, email, createdAt }, memberships: [{ companyId, role, company }] }`.
      **Sin `auth0Sub`** y sin `user.toJSON()`.

      > **Corrección de este doc (la hizo el worker, y era un error mío):** U2.2 pedía `execute(userId: string)`.
      > Es incoherente: con sólo un id no se pueden devolver `email` ni `createdAt`, y el repo de usuarios **no** está
      > en las superficies ni en `AppDependencies` (decisión #6). El insumo correcto es la entidad `User` ya resuelta
      > por `requireUser`. **U3.3 debe pasar `resolvedUser(request)`, no un string.**
- [x] **U2.3** El join por `companyId` con `companyRepository.findAllForUser(userId)`, descartando
      membresías sin empresa (decisión #4).
- [x] **U2.4** Test `tests/get-current-user.test.ts` con los repositorios en memoria: usuario con varias
      membresías y roles distintos; usuario sin membresías → `memberships: []`; **aserción de que la
      respuesta no contiene `auth0Sub`**; membresía activa cuya empresa no está en el listado → descartada.

### U3 — HTTP: controller, ruta y wiring

- [x] **U3.1** `interfaces/http/controllers/me-controller.ts` con `createMeController(dependencies)`,
      siguiendo `company-controller.ts` (factory, objeto de `RequestHandler`s, `try/catch → next(error)`,
      respuesta con objeto plano).
- [x] **U3.2** El controller lee el usuario con el helper `resolvedUser(request)` (mismo patrón que
      `company-controller.ts:43-51`), no con `request.user!`, y se lo pasa como **entidad** a
      `getCurrentUser.execute(user)` (ver corrección de U2.2).
- [x] **U3.3** `interfaces/http/routes/me-routes.ts` exportando `meRoutes(controller)` (simetría con
      `auth-routes.ts` / `company-routes.ts`), con `GET /me` detrás de `requireAuth` + `requireUser`.
- [x] **U3.4** Registrar en `interfaces/http/routes/index.ts` fuera del `router.use("/companies", ...)`,
      con un comentario que explique por qué `/me` no es company-scoped.
- [x] **U3.5** `interfaces/http/app.ts`: el use case entra en `AppDependencies` y en `buildApp`;
      `main.ts` lo construye como los demás.
- [x] **U3.6** Test `tests/me.test.ts` con el harness real (`tests/support/local-jwks-issuer.ts` +
      `createFakeUserRepository`): 200 con token y membresías; 401 sin token; 403 `user_not_provisioned`
      cuando el `sub` no resuelve a fila; **el JSON no contiene `auth0Sub`**; `memberships` vacío cuando
      el usuario no tiene empresas.

### U4 — Contrato en OpenAPI y README

- [x] **U4.1** `openapi.yaml`: path `/me` con `security: [{ bearerAuth: [] }]`, `200` (`MeResponse`),
      `401`, `403`, `429`, `500`, citando las `$ref` de responses ya existentes.
- [x] **U4.2** Schemas `MeResponse` y `MeMembership` (`required` explícitos; `role` con los valores del
      dominio: `OWNER`, `ADMIN`, `MEMBER`; **sin `auth0Sub`**).
- [x] **U4.3** `tests/openapi.test.ts`: agregar el handler en `buildRoutesForEnumeration`. El test es
      **bidireccional** (`missing` y `extraneous`): sin esto, la ruta nueva queda como extraneous y el
      test falla.
- [x] **U4.4** `README.md`: fila `GET /me` en la tabla de endpoints, con su token `sí` y sus errores.

### U5 — Verificación

- [x] **U5.1** `bun run test` y `bun run check-types` en `apps/api` en verde.
- [x] **U5.2** Lint del repo (`bun run lint`) sin warnings nuevos.
- [x] **U5.3** Verificación independiente (`gentle-ai-verify`) leyendo el diff real, no el reporte del
      worker: que `auth0Sub` no aparezca en ninguna respuesta, que el filtro `ACTIVE` esté en los dos
      adaptadores, que el test de OpenAPI enumere la ruta nueva, y que `/me` no pueda alcanzarse sin
      `requireAuth`.

## Evidencia

### U1 + U2 — delegadas a `gentle-ai-worker` (sin commit, sin staging)

**Test-first observado de verdad (RED antes de GREEN):**

| Ítem | RED (salida real) | GREEN |
| --- | --- | --- |
| U1 | `bun run test -- in-memory-membership-repository prisma-membership-repository` → **2 suites failed, 8 tests failed**, `TypeError: repository.findActiveByUser is not a function` (4 por suite) | mismas suites → **16 tests passed, 16 total** |
| U2 | `bun run test -- get-current-user` antes de crear el use case → **1 suite failed**, Jest no resuelve `../src/application/use-cases/get-current-user.js` | misma suite → **5 passed**, +1 de triangulación → **6 passed** |
| U1.1 | **Sin RED propio**: es una declaración de interfaz pura, no tiene comportamiento en runtime. Su RED se observa a través de los tests de los adaptadores que llaman al método inexistente. Desviación declarada, no escondida. | — |

**Verificación de la tanda:**

| Comando | Resultado real |
| --- | --- |
| `cd apps/api && bun run test` | **28 suites / 199 tests passed**, 0 failed (~3.7 s) |
| `cd apps/api && bun run check-types` | `tsc --noEmit`, **exit 0** |
| `bunx biome check <7 archivos>` | limpio (2 nits de formato corregidos con `--write`) |

**Nota sobre los tests de Prisma:** `prisma-membership-repository.test.ts` usa un doble escrito a mano del
delegate (`findFirst` + `findMany`), así que **corre de verdad sin Postgres**. No es un pase falso, pero
tampoco es evidencia contra la base real: la cláusula `WHERE { userId, status: "ACTIVE" }` está aseverada
explícitamente para que el aislamiento dependa del query y no del mapeo.

**Riesgos declarados por el worker:** el orden de las membresías no está especificado (ni el `Map` en memoria
ni Prisma llevan `orderBy`) y por eso no es parte del contrato; los tests comparan por mapa/orden explícito,
no por posición.

### U3 + U4 — delegadas a `gentle-ai-worker`

| Ítem | RED (salida real) | GREEN |
| --- | --- | --- |
| U3 (`tests/me.test.ts`) | `bun run test -- me.test` antes de cablear → **5 tests failed, 5 total**, cada uno `Expected: 200/403, Received: 404` | misma suite → **5 passed, 5 total** |
| U4.3 (enumeración) | quitando temporalmente la entrada del enumerador → **3 failed, 2 passed**, `TypeError: Cannot read properties of undefined (reading 'get')` en `me-routes.ts:18`. Restaurado al instante y re-corrido en verde. | — |
| U4.1/U4.2 (YAML/schemas) | **Sin RED de runtime propio**: es spec declarativa, no código ejecutable. Su enforcement real es el test de enumeración bidireccional. | — |

| Comando | Resultado real |
| --- | --- |
| `cd apps/api && bun run test` | **29 suites / 204 tests passed** (baseline 28/199 → +1 suite, +5 tests) |
| `cd apps/api && bun run check-types` | **exit 0** |
| `bun run lint` (raíz, biome) | **exit 0**, 221 archivos, sin fixes |

### U5 — verificación independiente (`gentle-ai-verify`, sin editar nada)

Verificado contra el diff real, no contra el reporte de los workers:

| # | Qué se verificó | Veredicto y evidencia |
| --- | --- | --- |
| 1 | `auth0Sub` no puede filtrarse | **VERIFICADO.** No existe ninguna llamada a `User.toJSON()` en `apps/api/src` (el único match es un comentario en `get-current-user.ts:12`). La vista se arma campo por campo (`get-current-user.ts:67-69`) y el controller emite `{ ...view, memberships }` (`me-controller.ts:49`). El guard (`me.test.ts:205`) asevera sobre `response.text` — el body **real** de Supertest — así que fallaría si la clave apareciera. |
| 2 | Filtro `ACTIVE` + scoping por usuario en ambos adaptadores | **VERIFICADO en código** (`in-memory-membership-repository.ts:41`, `prisma-membership-repository.ts:62`). Ver F2 sobre la fuerza del test de Prisma. |
| 3 | `/me` inalcanzable sin auth; `requireCompanyContext` nunca corre para `/me` | **VERIFICADO.** `me-routes.ts:18` monta `requireAuth, requireUser`; `routes/index.ts:21-29` registra fuera de `/companies`; `requireCompanyContext` sólo se usa dentro de `companyScoped` (`company-routes.ts:21`, confirmado por grep en todo `src`). |
| 4 | Acuerdo OpenAPI/router genuinamente bidireccional | **VERIFICADO.** `openapi.test.ts` asserta `missing` **y** `extraneous` (`:268,270`) con pruebas dedicadas: operación sólo en spec → `extraneous` (`:308`); handler con path distinto → `missing` (`:291`). |
| 5 | Fidelidad del contrato (body real vs `MeResponse`) | **VERIFICADO**, campo a campo, con `toEqual` exacto (`me.test.ts:104-137` vs `openapi.yaml:433-462`). Única divergencia: el `taxId` del **ejemplo de este doc**, ya corregido arriba. |
| 6 | El aplanado del controller | **Aceptado como mapeo de presentación**, pero es una **desviación real de la decisión #3** de este doc ("el controller no arma datos"): el use case agrupa en `{ user, memberships }` y el controller aplana al contrato de wire. No pierde campos (`{ ...view, memberships }`). Riesgo residual declarado: un campo futuro que se agregue a `CurrentUserView` se expondría solo en el wire. |
| 7 | Suites | `apps/api` verde (29/204), `check-types` exit 0, `lint` raíz exit 0. `apps/web` **rojo** — ver F1. |
| 8 | Causa del guard de deriva y capacidad offline del generador | Ver F1. La caché de `bunx` **está tibia** (`typescript@5.9.3`, `openapi-typescript@7.13.0`) y además hay red, así que `bun run openapi:generate` puede correr. El generador **no** se ejecutó (escribe archivos). |

#### Hallazgos abiertos

| ID | Severidad | Hallazgo | Estado |
| --- | --- | --- | --- |
| **F1** | **Bloqueante para el gate del repo** | `apps/web/lib/api/openapi-drift.test.ts` fallaba porque el stamp SHA-256 de `apps/web/lib/api/openapi.d.ts` quedó viejo tras el cambio de spec. `cd apps/web && bun run test` → **1 suite failed / 1 test failed** (231 passed). El gate raíz (`turbo`) incluye esa suite. Causa atribuida por evidencia: el diff de `openapi.yaml` es sólo `/me`, y los archivos del humano no tocan spec ni tipos. | **RESUELTO** — el usuario autorizó regenerar; entró en `bc3851c`. Gate raíz después: **exit 0** (`api` 29/204, `web` 39/232). El tipo generado no contiene `auth0Sub` (grep sin matches). |
| F2 | No bloqueante | El test "de aislamiento" de Prisma hace `findMany.mockResolvedValue([])` y sólo asevera los argumentos de la llamada: un doble a mano ignora el `where`, así que prueba que **se pasa** el filtro, no que excluya filas ajenas en runtime. La confianza real de aislamiento ahí es "el WHERE es correcto". El camino en memoria **sí** está ejercitado de verdad. | Registrado |
| F3 | No bloqueante | El ejemplo de contrato de este doc mencionaba `taxId`, que la entidad no proyecta. | **Corregido en este doc** |
| F4 | Proceso | Checkboxes desactualizados. | **Corregido en este doc** |
| F5 | No bloqueante | Sin cobertura: el `throw` de `resolvedUser` en `me-controller.ts:22-27` (500, sólo alcanzable con wiring roto) y el adaptador Prisma contra Postgres real. | Registrado |

### Cierre

**Work-unit commits** en `feat/login-register-backend-frontend`, armados con `git add` explícito de sólo los
archivos de esta feature:

| Commit | Unidades | Contenido |
| --- | --- | --- |
| `bffdd30` | U1 + U2 | `feat(api): read active memberships per user` — port + 2 adaptadores + use case + 3 suites |
| `bc3851c` | U3 + U4 (+ F1) | `feat(api): serve GET /me with identity and active memberships` — controller, ruta, wiring, OpenAPI, README, artefacto web regenerado |
| _(este commit)_ | U5 | `docs(odd): ...` — el doc con la evidencia |

Cada commit pasó los hooks del repo: `pre-commit` (`turbo run check-types` + `biome check --staged`) y
`commit-msg` (commitlint conventional). No se usó `--no-verify`. No hubo push.

**Gate raíz post-F1:** `bun run test` → **exit 0**; `api: 29 suites / 204 tests`, `web: 39 suites / 232 tests`.
`bun run check-types` → exit 0. `bun run lint` → exit 0 (221 archivos).

**Los archivos del humano quedaron intactos.** `apps/web/app/page.tsx` y `apps/web/src/layout/app-shell.tsx`
siguen modificados y sin commitear, exactamente como al empezar, y nunca entraron en un `git add`.

### Siguientes pasos (no incluidos en esta tarea)

1. Cablear el front: el session store guarda sólo `accessToken`; consumir `/me` para identidad y selección
   de empresa es una tarea aparte de `apps/web`.
2. F2 — reforzar el test de aislamiento de Prisma (hoy sólo prueba que se pasa el `WHERE`).
3. F5 — cubrir el `throw` de `resolvedUser` y, cuando haya base, el adaptador Prisma real.
4. Decisión de entrega: commit, push y PR siguen siendo tuyos.
