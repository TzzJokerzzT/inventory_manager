# Feature: `full_name` del usuario (`GET /me` + `PATCH /me`)

**Estado:** completado — 2 work-unit commits, gate raíz verde
**Fuente:** pedido del usuario (2026-10-09): (1) que `/me` traiga `full_name`; (2) un endpoint para que el usuario actualice su `full_name`, porque Auth0 no lo envía al verificar la cuenta. Sin issue de Jira.
**Requerimientos:** `docs/stack.md` §3.1 (el aislamiento es el mayor riesgo de seguridad), §5.8 (matriz de autorización)
**Rama:** `feat/login-register-backend-frontend`
**Depende de:** `odd/tasks/me-endpoint.md` (entrega `GET /me`, commits `bffdd30` / `bc3851c` / `d5fc71d`)

## Objetivo

1. `GET /me` incluye `fullName`.
2. `PATCH /me` deja que el **usuario autenticado** fije o borre su propio `full_name`.

## Contexto verificado (no asumido)

| Hecho | Evidencia |
| --- | --- |
| `users.full_name` **existe** en la base, nullable | `prisma/schema.prisma:57` (`fullName String? @map("full_name")`), `prisma/migrations/20261006223356_init/migration.sql:32` |
| `updated_at` lo mantiene Prisma solo | `schema.prisma` → `updatedAt DateTime @updatedAt` |
| `full_name` **no está modelado** en el dominio | `UserProps` (`domain/entities/user.ts:3-8`) no lo tiene; `toJSON()` no lo incluye |
| El adapter Prisma **lo descarta** al mapear | `PrismaUserRepository` reconstruye la entidad con `{ id, auth0Sub, email, createdAt }` en los 3 sitios |
| El port no permite actualizar nada | `UserRepository` sólo tiene `upsertFromIdentity` y `findByAuth0Sub` |
| Auth0 no provee el nombre | Es la causa del pedido: nace `NULL` y lo completa el usuario |

### El test que hay que reescribir, no borrar

`tests/prisma-user-repository.test.ts:87` asegura `not.toHaveProperty("fullName")`. **Su comentario
aclara que es un guard contra columnas crudas de Prisma** ("The raw row carried extra columns; the
domain entity exposes none of them"), y en la línea siguiente también asegura que `updatedAt` no se
exponga. Al modelar `fullName` ese guard queda **parcialmente obsoleto**: hay que actualizarlo para
que siga cubriendo `updatedAt` y ahora **espere** `fullName`. Borrarlo, o dejarlo como está, son las
dos formas de perder la protección.

## Contrato

`GET /me` → **200**, igual que hoy más `fullName`:

```json
{ "id": "uuid", "email": "user@example.com", "fullName": "Alexis Buelvas",
  "createdAt": "2026-10-09T12:00:00.000Z",
  "memberships": [ { "companyId": "uuid", "role": "OWNER", "company": { "id": "uuid", "name": "Acme", "createdAt": "..." } } ] }
```

`fullName` es `null` cuando el usuario todavía no lo cargó.

`PATCH /me` → **200** con **la misma representación que `GET /me`** (es una actualización parcial del
recurso `/me`; el cliente reemplaza su estado con una sola forma de payload).

```json
{ "fullName": "Alexis Buelvas" }
```

| Caso | Respuesta |
| --- | --- |
| `{"fullName": "  Alexis Buelvas  "}` | **200**, guarda `"Alexis Buelvas"` (trim) |
| `{"fullName": null}` | **200**, `full_name` vuelve a `NULL` |
| `{"fullName": ""}` | **200**, `full_name` vuelve a `NULL` |
| `{"fullName": "   "}` | **200**, `full_name` vuelve a `NULL` |
| `{"fullName": 42}` / array / objeto / booleano | **400** |
| sin el campo `fullName` (`{}`) | **400** |
| `fullName` con más de 120 caracteres tras trim | **400** |
| sin token válido | **401** (lo emite `requireAuth`) |
| token válido sin fila en `users` | **403** `user_not_provisioned` (lo emite `requireUser`) |
| rate limit | **429** |

Los `400` usan el formato que ya emite `error-handler.ts` (`{ error: { message, issues } }`), no un
código nuevo inventado.

## Decisiones de implementación

1. **Self-only, y no se pregunta: no existe base para otra cosa.** Los roles (`OWNER`/`ADMIN`/`MEMBER`)
   son **por empresa**, no globales, así que "editar cualquier usuario" no tendría autorización que lo
   respalde. El sujeto sale siempre de `request.user`; el body **nunca** acepta `userId` ni `email`.
   Es la misma invariante que `company_id`: el identificador no se confía al cliente.
2. **`null`, `""` y sólo-espacios borran el nombre** (decisión del usuario, 2026-10-09). El tope de
   **120 caracteres** también es decisión del usuario (lo endosó al elegir la opción de validación
   obligatoria). El vacío **no** es 400: es una acción válida de borrado.
3. **La validación de forma va en el borde HTTP (valibot) y la normalización en el dominio.** El tope
   de 120 y el tipo (string o null) son reglas de entrada → valibot → **400**, consistente con el
   resto de la API. El trim y el `"" → null` son invariantes de representación → dominio, donde no se
   pueden esquivar. Se agrega un único punto de normalización en `User` y lo usan `User.create` y los
   adaptadores de update.
4. **`request.user` queda STALE después del `PATCH`.** `requireUser` resolvió la entidad **antes** de
   la escritura, así que recomponer la vista con ella devolvería el nombre **anterior** en un `200`.
   Por eso `UpdateUserFullNameUseCase.execute(...)` **devuelve la entidad actualizada** y el controller
   pasa **esa** a `GetCurrentUserUseCase` para armar la respuesta. Hay un test de regresión obligatorio
   para esto: es exactamente el bug que un `200` con el nombre viejo oculta.
5. **El `PATCH` no toca ningún otro campo.** En particular `upsertFromIdentity` sigue refrescando sólo
   `email` en su rama de `update`: un segundo login **no** debe pisar el `full_name` que el usuario
   cargó a mano. Es no-regresión, no una mejora.
6. **Auth0 no se sincroniza.** La base es la fuente de verdad de `full_name`; devolver el nombre al
   proveedor es otro alcance y otra decisión.
7. **Regenerar `apps/web/lib/api/openapi.d.ts`.** El guard de deriva (`apps/web/lib/api/openapi-drift.test.ts`)
   compara el SHA-256 del spec contra el stamp del artefacto: cualquier cambio de `openapi.yaml` deja
   el gate raíz rojo hasta regenerar. Ya está identificado y costó un ciclo la vez anterior.

## Tareas

### U1 — Dominio, port y adaptadores

- [x] **U1.1** `domain/entities/user.ts`: `fullName: string | null` en `UserProps` y en `CreateUserProps`
      (opcional), getter, y `toJSON()` que lo incluye.
- [x] **U1.2** Un único punto de normalización exportado en `User` (trim; `""` y sólo-espacios → `null`),
      usado por `User.create`. Documentar por qué vive ahí y no en el HTTP.
- [x] **U1.3** `domain/repositories/user-repository.ts`: `updateFullName(userId: string, fullName: string | null): Promise<User | null>`.
      Devuelve **`null` si no hay fila**, no un `User` inventado: existe una carrera real (el usuario se
      borra entre `requireUser` y el `PATCH`) y con `Promise<User>` esa carrera salía como **500** con un
      error crudo de Prisma (P2025). Con `null`, el use case tira `UserNotProvisionedError` → **403**,
      el mismo resultado que ya da `requireUser` cuando el `sub` no resuelve. Fail-closed.
- [x] **U1.4** `infrastructure/database/prisma-user-repository.ts`: mapear `fullName` en los **3** sitios
      de mapeo (`upsert` create-path, `upsert` return, `findByAuth0Sub`) e implementar `updateFullName`
      por clave primaria. La rama `update` del upsert **sigue** tocando sólo `email`.
- [x] **U1.5** `tests/support/fake-user-repository.ts`: soportar `fullName` y `updateFullName`.
- [x] **U1.6** Tests: `tests/user.test.ts` (normalización: trim, `""` → null, espacios → null, y que el
      `toJSON()` incluya `fullName`), `tests/prisma-user-repository.test.ts` (**reescribir el guard de
      la línea 87** para que siga cubriendo `updatedAt` y ahora espere `fullName`, más
      `updateFullName`), y el fake.

### U2 — Use case de actualización y vista de `/me`

- [x] **U2.1** `application/use-cases/update-user-full-name.ts`, mismo patrón que los demás
      (`class` + `interface ...Dependencies` + `execute`): recibe la entidad `User` y el
      `fullName: string | null` del body, y **devuelve la entidad `User` actualizada** (decisión #4).
      Si el port devuelve `null` (fila ausente), tira `UserNotProvisionedError` → **403**, no un 500.
- [x] **U2.2** `application/use-cases/get-current-user.ts`: la vista pública suma `fullName`. Sigue
      **sin** `auth0Sub` y **sin** `user.toJSON()`.
- [x] **U2.3** Tests: `tests/update-user-full-name.test.ts` (fija un nombre; lo borra con `null`;
      recorta espacios; devuelve la entidad con el valor nuevo) y actualizar
      `tests/get-current-user.test.ts` para el campo nuevo, **manteniendo** la aserción de que no
      aparece `auth0Sub`.

### U3 — HTTP: validator, handler y ruta

- [x] **U3.1** Validator valibot del body de `PATCH /me`: `fullName` **presente**, del tipo
      `string | null`, máximo 120 tras trim. `{ }` y tipos equivocados → 400 por el `errorHandler`
      existente.
- [x] **U3.2** `interfaces/http/controllers/me-controller.ts`: agregar el handler de update. Usa
      `resolvedUser(request)`, corre `UpdateUserFullNameUseCase`, y arma la respuesta pasando **la
      entidad actualizada** a `GetCurrentUserUseCase` (decisión #4).
- [x] **U3.3** `interfaces/http/routes/me-routes.ts`: `PATCH /me` con `requireAuth` + `requireUser`.
- [x] **U3.4** `interfaces/http/app.ts` y `main.ts`: inyectar el use case nuevo como los demás (sin
      agregar repositorios a `AppDependencies`).
- [x] **U3.5** Tests en `tests/me.test.ts`: `PATCH` fija el nombre y el `200` devuelve **el nombre
      nuevo** (regresión de la decisión #4); `null`, `""` y `"   "` borran; `{}` → 400; tipo inválido →
      400; 121 caracteres → 400; sin token → 401; sin fila en `users` → 403; y que la respuesta
      **no** contenga `auth0Sub`.

### U4 — Contrato en OpenAPI, README y artefacto generado

- [x] **U4.1** `openapi.yaml`: `fullName` (nullable) en `MeResponse`; operación `patch` en `/me` con
      `security: [{ bearerAuth: [] }]`, `requestBody` con su schema (`UpdateMeRequest`), y `200`
      → `MeResponse` más `400`/`401`/`403`/`429`/`500`.
- [x] **U4.2** `tests/openapi.test.ts`: registrar el handler nuevo en `buildRoutesForEnumeration` (el
      test es bidireccional: sin eso, la ruta queda como `extraneous` y falla).
- [x] **U4.3** `README.md`: fila `PATCH /me` en la tabla de endpoints y actualizar la descripción de
      `GET /me` para incluir `fullName`.
- [x] **U4.4** **Regenerar** `apps/web/lib/api/openapi.d.ts` con `cd apps/web && bun run openapi:generate`
      y confirmar que el gate raíz vuelve a verde.

### U5 — Verificación

- [x] **U5.1** `bun run test` (raíz) y `bun run check-types` en verde.
- [x] **U5.2** `bun run lint` sin warnings nuevos.
- [x] **U5.3** Verificación independiente (`gentle-ai-verify`) sobre el diff real: que no exista ninguna
      vía para que un usuario escriba el `full_name` **de otro**; que `auth0Sub` siga sin exponerse;
      que el `200` del `PATCH` no pueda devolver el nombre viejo; y que el guard reescrito siga
      detectando una columna cruda de Prisma.

## Evidencia

### U1 + U2 — `gentle-ai-worker` (commits `b1f48e3`)

**RED antes de GREEN:** corrida focalizada sobre las 5 suites tocadas → **5 suites failed, 19 tests failed / 14 passed**.
Fallos reales observados: `User.normalizeFullName is not a function`; `user.fullName` → `undefined`; `toJSON` sin `fullName`;
`repository.updateFullName is not a function` (×4); la vista de `get-current-user` sin `fullName` y con el key set
desalineado; el `toEqual` del body de `GET /me` sin `fullName` (×2); la suite nueva sin poder resolver el módulo.
**GREEN:** las mismas 5 suites → **39 passed**. Suite completa: **30 suites / 224 tests**.

También se observó RED real por la dependencia cruzada que se detectó antes de delegar: `tests/me.test.ts:130` asegura el body
de `GET /me` con `toEqual` exacto, así que agregar `fullName` a la vista lo rompía. Por eso ese archivo entró en las
superficies de U1/U2 pese a ser "de U3".

### U3 + U4 — `gentle-ai-worker` (commit `4f62b09`)

| Ítem | RED real | GREEN |
| --- | --- | --- |
| U3 | `bun run test tests/me.test.ts` → **15 failed / 5 passed**, todos los PATCH con `Expected 200 Received 404` | 20 passed |
| U4.2 | `bun run test tests/openapi.test.ts` → **2 failed / 3 passed**, `missing: "PATCH /me"` | 5 passed |
| U4.1 | **Sin RED de runtime**: es spec declarativa. Su enforcement real es el test de enumeración bidireccional. | — |

### Consolidación posterior a la verificación (mismo commit `4f62b09`)

Se cerraron dos huecos y un error de contrato que destapó la verificación:

- Test del **invariante self-only en el borde HTTP**: un body con `userId` y `email` extra no escribe en la fila ajena ni
  cambia la identidad del llamador. Hoy el descarte de claves extra depende de una **implementación interna de valibot**
  (su `object` reconstruye `dataset.value` copiando sólo las claves declaradas); el test lo fija para que un cambio futuro a
  una forma loose/rest no debilite el aislamiento en silencio.
- Test del **límite aceptado**: exactamente 120 caracteres tras el trim → 200. El suite ya probaba 121 (rechazado) pero no el
  borde aceptado, y el caso usa 124 caracteres crudos con espacios, así que **sólo pasa si el trim ocurre antes del tope**.
- **Corrección del contrato en `openapi.yaml`**: la descripción de `UpdateMeRequest.fullName` decía que el tope de 120 cuenta
  el valor **después** del trim, pero `maxLength: 120` en el schema mide la cadena **cruda** → las dos afirmaciones se
  contradecían (un valor de 122 crudos con dos espacios lo acepta el servidor). La descripción ahora dice la verdad y el
  schema queda **deliberadamente más estricto** que el servidor para el cliente.

**RED observado en esta tanda:** sólo el de la regeneración — `bun run test lib/api/openapi-drift.test.ts` → **1 failed**, con
stamp `cf7e7d14…` contra spec `4e3b120d…`. Los dos tests nuevos **fijan comportamiento existente y pasaron de entrada**: no
hubo RED propio y se declara así en vez de inventarlo. Su valor es de **regresión**, no de diseño.

| Comando | Resultado real |
| --- | --- |
| `cd apps/api && bun run test` | **30 suites / 241 tests passed**, exit 0 |
| `cd apps/api && bun run check-types` | `tsc --noEmit`, **exit 0** |
| `cd apps/web && bun run test` | **39 suites / 232 tests passed**, exit 0 (incluye el drift guard) |
| `bun run lint` (raíz) | **exit 0**, 224 archivos, sin fixes |

### U5 — verificación independiente (`gentle-ai-verify`, sin editar nada)

| # | Qué se verificó | Veredicto y evidencia |
| --- | --- | --- |
| 1 | Ninguna vía escribe el `full_name` de otro | **VERIFICADO.** `me-routes.ts:21` → `require-user.ts:56` (sujeto = `sub` del token) → `me-controller.ts:39-47,66-70` → `update-user-full-name.ts:32-33` (sólo `user.id`) → `prisma-user-repository.ts:112-115` (`where: { id: userId }`, PK). El body no puede nombrar a otro: valibot reconstruye el objeto con sólo las claves declaradas (verificado en el fuente instalado, `valibot@1.5.0/dist/index.mjs:5665-5670`). Test dedicado: `update-user-full-name.test.ts:69-88`. |
| 2 | `auth0Sub` sigue sin exponerse | **VERIFICADO.** `get-current-user.ts:69-74` arma la vista campo por campo; ningún `.toJSON()` en `src`. Aserciones sobre el body serializado real: `me.test.ts:217-219` (GET) y `:405-406` (PATCH), ambas sobre `response.text`. |
| 3 | El `200` del PATCH no puede devolver el nombre viejo | **VERIFICADO, guard genuino.** `me-controller.ts:66-77` pasa la entidad **actualizada**. `User` es inmutable (props `readonly`, sin setters), así que `requireUser` conserva la instancia previa: pasar la vieja serializaría `null` y el test `me.test.ts:238-256` fallaría. |
| 4 | El guard de columnas crudas sigue siendo guard | **PARCIAL — debilidad previa, no introducida.** La mitad nueva sí es guard real (`result.fullName === "Jane"`, `prisma-user-repository.test.ts:90-91`, falla si el adapter deja de mapear). La mitad de `updatedAt` (`:94`) es estructuralmente débil: inspecciona `toJSON()`, que devuelve 5 claves explícitas, así que una columna cruda **no puede** llegar a esa aserción. Ya era así antes del cambio. |
| 5 | Normalización en dominio y tope en el validador | **VERIFICADO.** `user.ts:42-53` (trim; `""`/espacios → `null`), sin tope de longitud en el dominio. Tope sólo en `me-validator.ts:17-21` (`v.trim()` y después `v.maxLength(120)`), así que falla como `ValiError` → **400** (`error-handler.ts:68-75`). Códigos aseverados: 121 chars → 400, `{}` → 400, tipo equivocado → 400. |
| 6 | Un segundo login no pisa el nombre cargado | **VERIFICADO y anclado por test.** `prisma-user-repository.ts:73` sólo escribe `email`; lo fija `prisma-user-repository.test.ts:60` con `toEqual` sobre los argumentos reales del upsert. |
| 7 | Fidelidad del contrato | **VERIFICADO**, campo a campo. `MeResponse.required` = `[id, email, fullName, createdAt, memberships]`, todos siempre serializados; `fullName` con la forma nullable de **3.0.3**. Corregida la única imprecisión (ver arriba). **Límite declarado:** `openapi.test.ts` sólo reconcilia rutas↔operaciones y **no** valida bodies serializados contra schemas, así que este ítem es manual. |
| 8 | Artefacto generado en sincronía | **VERIFICADO.** El stamp iguala `sha256sum` (`4e3b120d…`); el diff trae `patch`, `MeResponse.fullName: string \| null` y `UpdateMeRequest`; **sin** `auth0Sub` en los tipos generados. |
| 9 | Suites | api **30/241**, check-types exit 0, web **39/232**, lint raíz exit 0. |
| 10 | Huecos | Ver *Hallazgos abiertos*. |

**Bloqueantes para merge: ninguno.**

## Hallazgos abiertos

| ID | Severidad | Hallazgo | Estado |
| --- | --- | --- | --- |
| G1 | No bloqueante | **11 archivos de test construyen la app sin la dependencia nueva** (`auth-login:135`, `auth-logout:85`, `auth-refresh:98`, `auth-register:93`, `company-bootstrap:44`, `company-context:69`, `cors:27`, `media-signature:88`, `require-auth:39`, `require-user:43`, `smoke:38`). **Seguro por accidente, no roto en silencio:** los tests están excluidos de `tsconfig.json` (`include: ["src/**/*.ts"]`), así que `check-types` no puede detectarlo, y `buildApp` lee cada dependencia de forma perezosa dentro del handler — ninguno de esos apps ejercita `PATCH /me`. Un `PATCH` futuro ahí daría 500. | Registrado |
| G2 | No bloqueante | **Comportamiento nuevo sin test:** que el límite de exactamente 120 crudos ya está cubierto tras la consolidación, pero sigue sin cubrirse la **carrera de punta a punta** (que `requireUser` resuelva y `updateFullName` devuelva `null`) en el mapeo controller + error-handler; sólo está cubierto el throw del use case y el 403 previo del middleware. | Registrado |
| G3 | No bloqueante | `isRecordNotFound` (`prisma-user-repository.ts:23-30`) matchea **cualquier** objeto con `code === "P2025"`. **Aceptable:** la superficie de falso positivo es un error ajeno que literalmente lleve ese código, y la consecuencia es un **403 fail-closed** (`UserNotProvisionedError` → `error-handler.ts:102-108`), sin exposición de datos. Endurecerlo (exigir también `name === "PrismaClientKnownRequestError"`) es opcional. | Registrado |

## Cierre

**Work-unit commits** en `feat/login-register-backend-frontend`, con `git add` explícito:

| Commit | Unidades | Contenido |
| --- | --- | --- |
| `b1f48e3` | U1 | `feat(api): model full_name on the user` — campo, normalización, port, adaptadores, fake y el guard reescrito |
| `4f62b09` | U2 + U3 + U4 | `feat(api): expose full_name in GET /me and set it with PATCH /me` — vista, use case, validador, handler, ruta, wiring, OpenAPI, README y artefacto regenerado |
| _(este commit)_ | U5 | `docs(odd): ...` — el doc con la evidencia |

**Por qué el split no pudo ser por unidad estricta:** U2, U3 y U4 comparten `apps/api/tests/me.test.ts`. U2 agrega `fullName`
la vista y eso rompe el `toEqual` exacto del body de `GET /me`; U3 agrega los tests de `PATCH` en el mismo archivo. Separarlos
habría exigido un commit intermedio con el árbol en rojo, y preferí un commit de dos que mantener una historia que falla al
hacer bisect. **U1 sí se separó** porque es independiente y deja el árbol verde por construcción.

**Sobre "verde por construcción" (sin maquillar):** la verdez del commit intermedio `b1f48e3` es **razonada, no observada** —no
ejecuté el suite sobre ese árbol. El razonamiento: en `b1f48e3` ni la vista de `/me` ni `me.test.ts` cambian, así que la
aserción vieja sigue alineada con el `src` viejo.

Cada commit pasó los hooks del repo (`pre-commit`: `turbo run check-types` + `biome check --staged`; `commit-msg`: commitlint).
No se usó `--no-verify`. No hubo push.

## Pendiente heredado y decisión abierta

1. **La revisión nativa del candidato de `/me` sigue sin hacerse.** El candidato válido ahora es el rango commiteado
   `e55d13d..HEAD`, que ya incluye `fullName` y `PATCH /me`. Nada de autoridad se quemó. Para arrancarla:
   `gentle_review` `inspect` con `{"baseRef":"<sha completo de e55d13d>","committedOnly":true}`.
2. **La lineage `review-94960dec2087219c`** (review aprobada del trabajo sin commitear que había en `apps/web`) sigue con
   su acknowledgement sin ejecutar por `native-approved-acknowledgement-not-current`: el árbol cambió bajo la review. Queda
   la decisión del usuario.
3. **Cablear el front**: nada en `apps/web` consume todavía ni `fullName` ni `PATCH /me`. Es tarea aparte.
4. **Commits, push y PR**: siguen siendo decisión del usuario.

## Pendiente heredado al momento de planificar

**La revisión nativa del candidato commiteado de `/me` (`b1463eed…`, rango `e55d13d..HEAD`) seguía sin hacerse** cuando se
planificó esta feature, y esta feature lo modifica. Ver *Pendiente heredado y decisión abierta* al final del doc.
