# Invitaciones pendientes y notificaciones

## Objetivo

Cerrar los dos huecos que dejó la gestión de miembros en el frontend, sin agregar infraestructura:

1. Que el **invitado** pueda ver sus invitaciones pendientes (hoy la UI sólo puede llamar al endpoint de aceptación a ciegas).
2. Que el **invitador** se entere en la app cuando el invitado acepta.

## Decisiones del usuario

| # | Decisión |
|---|---|
| 1 | Las invitaciones pendientes del invitado se leen **desde `memberships`** (`invitedEmail` + `status = INVITED`). **No** se agrega ningún campo en `users`. |
| 2 | La notificación al invitador **se implementa** (no tiene costo monetario). |
| 3 | **Sin tiempo real**: no hay polling, ni SSE, ni webhooks. El jefe no espera pegado a la pantalla; la notificación persistida en la app alcanza, y si necesita más le escribe al empleado por sus propios canales. |
| 4 | Las notificaciones **se purgan**. |
| 5 | **Pendientes** (estado actual) y **notificaciones** (eventos) son entidades **separadas**. |
| 6 | El invitador **sí se muestra**: `{ id, fullName, email }`. `fullName` es nullable (un usuario de Auth0 arranca sin nombre), así que la UI cae al email y, si el invitador no se pudo resolver, a una etiqueta neutra. **Una invitación nunca se oculta por falta de nombre**: la invitación es el hecho, el invitador es contexto. |
| 7 | Las notificaciones se ven **en la misma vista de usuario**. Cuando existan las de stock bajo se reconsidera el destino. |

## Modelo

| | **Invitación pendiente** | **Notificación** |
|---|---|---|
| Qué es | Estado actual: la invitación sigue abierta | Evento: "X aceptó tu invitación" |
| Dónde vive | `memberships` (ya existe, con índice `[invitedEmail, status]`) | Tabla nueva `notifications` |
| Se lee con | `GET /me/invitations` | `GET /me/notifications` + marcar leídas |
| Para quién | El invitado | El invitador |
| Desaparece cuando | Acepta, o lo revocan | Purga a los 90 días |

El criterio del invitado es **el mismo** que usa `AcceptInvitationsUseCase` (`findInvitedByEmail(user.email)`), para que no existan dos definiciones de "invitación pendiente".

## Slices

### A1 — Backend: leer las invitaciones pendientes (sin migración)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `findByIds(ids)` en el puerto de empresas (batch, sin N+1) | `domain/repositories/company-repository.ts` | done |
| 2 | Implementar en los adaptadores Prisma e in-memory | `infrastructure/database/*company-repository.ts` | done |
| 3 | `ListPendingInvitationsUseCase` | `application/use-cases/list-pending-invitations.ts` | done |
| 4 | `GET /me/invitations` (controller + ruta) | `interfaces/http/controllers/me-controller.ts`, `routes/me-routes.ts` | done |
| 5 | Contrato OpenAPI + regenerar tipos del web | `apps/api/openapi.yaml`, `apps/web/lib/api/openapi.d.ts` | done |
| 6 | Wiring + stub del test de contrato | `app.ts`, `main.ts`, `tests/openapi.test.ts` | done |
| 7 | Tests: use case y endpoint | `apps/api/tests/list-pending-invitations*.test.ts` | done |

Respuesta: `{ membershipId, companyId, role, invitedAt, company: { id, name, createdAt } }[]`. La empresa es lo que hace útil la lista (sin ella dice "tenés una invitación" y no **a qué**). El `company` es el mismo join en memoria que ya hace `GET /me`.

### A2 — Invitador nombrado + sección condicional (rebanada vertical)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `findByIds` en el puerto de usuarios (batch, dedup antes de leer) | `domain/repositories/user-repository.ts`, `prisma-user-repository.ts`, `tests/support/fake-user-repository.ts` | done |
| 2 | `inviter: { id, fullName, email } \| null` en la respuesta | `application/use-cases/list-pending-invitations.ts` | done |
| 3 | Contrato (`InviterSummary`, nullable) + regenerar tipos del web | `openapi.yaml`, `apps/web/lib/api/openapi.d.ts` | done |
| 4 | `pendingInvitationSchema` + `parsePendingInvitations` | `lib/api/schemas.ts` | done |
| 5 | `use-pending-invitations` (clave `["pending-invitations"]`) | `src/features/member/api/` | done |
| 6 | Aceptar también invalida `["pending-invitations"]` → la sección desaparece | `src/features/member/api/use-accept-invitations.ts` | done |
| 7 | Sección que **sólo se renderiza si hay pendientes**, con empresa, rol, fecha e invitador | `src/features/member/components/pending-invitations-section.tsx` | done |
| 8 | Montarla en el panel, en lugar del bloque siempre visible | `src/features/user/components/user.tsx` | done |
| 9 | Tests (API y web) | `apps/api/tests/*`, `apps/web/src/features/member/**/__tests__/`, `apps/web/lib/api/schemas.test.ts` | done |

La sección reemplaza al botón a ciegas actual: con la lista, el botón ya no es una apuesta.

### B — Backend: notificaciones

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Migración: tabla `notifications` (`id`, `user_id`, `type`, `payload`, `dedupe_key` único, `read_at`, `created_at` + índices) | `prisma/schema.prisma`, `prisma/migrations/*` | done |
| 2 | Entidad + puerto + adaptadores (Prisma e in-memory) | `domain/entities/notification.ts`, `domain/repositories/notification-repository.ts`, `infrastructure/database/*notification-repository.ts` | done |
| 3 | Crear la notificación en el accept: **segunda escritura idempotente**, no atómica (ver decisión abajo) | `application/use-cases/accept-invitations.ts` | done |
| 4 | Purga **sin cron**: `DELETE` de lo anterior a 90 días en la misma transacción donde se escribe | adaptador Prisma | done |
| 5 | `GET /me/notifications` + `POST /me/notifications/read` | `controllers/me-controller.ts`, `routes/me-routes.ts` | done |
| 6 | Contrato + regenerar tipos | `openapi.yaml`, `apps/web/lib/api/openapi.d.ts` | done |
| 7 | Tests | `apps/api/tests/*notification*`, `tests/accept-invitations*.test.ts` | done |

**Corrección de la tarea 3:** el plan original decía "en la transacción del accept". **No se hizo así, a propósito.** La notificación es una **segunda escritura idempotente** (clave de deduplicación única: `membership.accepted:<membershipId>`). El motivo es de límites: un adaptador que escribe la tabla de otro agregado —o un CTE que hace `UPDATE` en una tabla e `INSERT` en otra— acopla los dos contextos y hace que el invariante de membresías dependa del esquema de notificaciones. **Ventana declarada:** un `kill -9` entre las dos escrituras pierde la notificación mientras la membresía queda `ACTIVE`; el invitador sigue viendo la verdad en el roster. Si se quiere atomicidad real, el camino es un *unit of work*, que es un refactor aparte y no se cuela dentro de esta rebanada.

La ventana omitida **no corrompe estado**, y el camino de falla está **cubierto por un test**, no sólo silenciado: `accept-invitations.test.ts` inyecta un repositorio que lanza y aserta que la aceptación igual devuelve la membresía (el fallo secundario no deshace lo ya aceptado).

### C — Frontend: bloque de novedades

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Schemas + hooks (`use-notifications`, marcar leída) | `lib/api/schemas.ts`, `src/features/member/api/` | pending |
| 2 | Bloque de novedades en la vista de usuario | `src/features/member/components/` | pending |
| 3 | Tests | `src/features/member/**/__tests__/` | pending |

## Sin tiempo real: por qué alcanza

- `refetchOnWindowFocus` viene en **`true`** en TanStack Query: al volver a la pestaña, la lista se revalida sola.
- Con las notificaciones **persistidas**, no hay evento que se pierda: el invitador abre el panel cuando quiere y la novedad está.
- No se usa `refetchInterval`: el valor de un timer es cero si nadie espera el evento, y su costo es real (invocación serverless + round trip al pooler). Se puede agregar después sin rehacer nada, porque el modelo ya existe.

## Costo

**$0 de infraestructura.** Mismo Postgres y mismas funciones serverless; sin proveedor de email, sin Redis/KV, sin colas, sin cron, sin servicio de websockets. El único costo es de desarrollo. El slice B **baja** las invocaciones al no pollear.

## Evidencia

### A1 — Backend de invitaciones pendientes

- `cd apps/api && bun run test` → **38 suites / 353 tests, 0 fallos**
- `cd apps/api && bun run check-types` → OK
- `cd apps/web && bun run openapi:generate` + `bun run test lib/api/openapi-drift.test.ts` → OK (el artefacto generado viaja con la spec)
- `bunx biome check apps/api apps/web` → 289 archivos, sin errores
- RED observado antes del GREEN: las dos suites nuevas no cargaban (módulo inexistente) y ambos adaptadores fallaban con `repository.findByIds is not a function`. Reportado, no escondido.

La lectura reusa **exactamente** el criterio del `AcceptInvitationsUseCase` (`findInvitedByEmail(user.email)`), así que no hay dos definiciones de "invitación pendiente". Las empresas se resuelven en **una sola** llamada batch después de la lectura de membresías: dos queries, nunca N+1. Una membresía cuya empresa el batch no devolvió se descarta **fail-closed**, igual que `GET /me`.

_(B y C pendientes)_

### A2 — Invitador nombrado y sección condicional

- `cd apps/api && bun run test` → **38 suites / 358 tests, 0 fallos**
- `cd apps/web && bun run test` → **56 suites / 353 tests, 0 fallos**
- `check-types` en ambos lados → OK · `bunx biome check apps/api apps/web` → 293 archivos, sin errores
- El artefacto generado del web se regeneró con `bun run openapi:generate` (nunca a mano)

La lectura quedó en **tres queries** (membresías → empresas en batch → invitadores en batch), con los ids de invitador **deduplicados** antes de leer: varias invitaciones del mismo jefe cuestan una sola consulta. Un invitador que el batch no devolvió **no oculta la invitación**: responde `inviter: null` y la UI usa una etiqueta neutra. Una empresa que el batch no devolvió sí descarta la fila (fail-closed), como en `GET /me`.

**Límite declarado:** la sección devuelve `null` mientras la lectura está en vuelo **y si falla**. Es deliberado (no mostrar una lista falsa ni alarmar por un bloque secundario), pero significa que un error de `/me/invitations` es **silencioso** en el panel. Se puede agregar un reintento cuando el bloque crezca.

**Desviación declarada:** no se observó un RED real en esta rebanada — los tests y la implementación se escribieron juntos. Como chequeo de carga se forzó temporalmente `inviter = undefined` y se verificó que los tests fallaban, revirtiendo después. Es una mutación, no un RED.

### B — Notificaciones persistidas

- `cd apps/api && bun run test` → **43 suites / 405 tests, 0 fallos**, y **cero** `console.error` en toda la corrida
- `cd apps/api && bun run check-types` → OK · `bunx biome check apps/api apps/web` → 304 archivos, sin errores
- Migración escrita a mano y validada **offline** contra el esquema con `prisma migrate diff --from-empty --to-schema`: el DDL coincide exactamente (tabla, `notifications_dedupe_key_key`, índice `(user_id, created_at DESC)`, FK `ON DELETE RESTRICT`). `prisma migrate dev` **no se corrió** (no hay base viva en este entorno) — declarado.
- El cliente Prisma generado está **gitignoreado**, así que regenerarlo no ensucia el diff.

Detalles que importan: la lectura resuelve las empresas con el `findByIds` batch que ya existía (sin N+1), es **por usuario** (nunca se lee ni se marca la de otro) y `company: null` no oculta el evento. La purga de 90 días corre en la misma transacción que el insert.

**Desviación declarada:** tampoco hubo RED limpio acá; el único rojo real fue una aserción mía mal escrita (orden en `list-notifications`) que se corrigió en el test, no en el código.

### Hallazgo de infraestructura de tests (no es de esta rebanada)

`apps/api/tsconfig.json` tiene `"include": ["src/**/*.ts"]`, así que **`bun run check-types` no type-checkea `tests/`**. Un test puede llamar a un caso de uso omitiendo una dependencia obligatoria y compila igual; el error aparece recién en runtime. Ya pasó dos veces en esta sesión con los montajes que agregaban dependencias. Arreglarlo (un `tsconfig` de tests o incluirlos) es trabajo aparte.

## Fuera de alcance

- Email (Fase 4, MI-13) y sus webhooks de entrega/lectura.
- Tiempo real (SSE/WebSocket): `docs/stack.md:156` lo deja fuera del MVP.
- Campanita global en el shell y contador de no leídas: se reconsidera con las notificaciones de stock bajo.
- Notificar por revocación/cambio de rol: el modelo queda listo (`type` + `payload`), pero la UI se hace cuando exista el caso.
