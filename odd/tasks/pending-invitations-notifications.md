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
| 6 | El nombre del invitador **no se muestra**: la autoridad es de la empresa y sus roles, y el rol ofrecido ya viaja en la lista. |
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

### A2 — Frontend: sección condicional

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `pendingInvitationSchema` + `parsePendingInvitations` | `lib/api/schemas.ts` | pending |
| 2 | `use-pending-invitations` | `src/features/member/api/` | pending |
| 3 | Sección que sólo se muestra **si hay pendientes**, con empresa y rol | `src/features/member/components/` | pending |
| 4 | Tests | `src/features/member/**/__tests__/` | pending |

La sección reemplaza al botón a ciegas actual: con la lista, el botón ya no es una apuesta.

### B — Backend: notificaciones

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Migración: tabla `notifications` (`id`, `user_id`, `type`, `payload`, `read_at`, `created_at` + índices) | `prisma/schema.prisma` | pending |
| 2 | Entidad + puerto + adaptadores (Prisma e in-memory) | `domain/entities/`, `domain/repositories/`, `infrastructure/database/` | pending |
| 3 | Crear la notificación **en la transacción del accept** (a quién notificar ya está en `membership.invitedBy`: sin cola ni outbox) | `application/use-cases/accept-invitations.ts` | pending |
| 4 | Purga **sin cron**: `DELETE` oportunista de lo anterior a 90 días, en la misma transacción donde se escribe | adaptador + use case | pending |
| 5 | `GET /me/notifications` + marcar como leída | controller + rutas | pending |
| 6 | Contrato + regenerar tipos | `openapi.yaml`, `openapi.d.ts` | pending |
| 7 | Tests | `apps/api/tests/*` | pending |

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

## Fuera de alcance

- Email (Fase 4, MI-13) y sus webhooks de entrega/lectura.
- Tiempo real (SSE/WebSocket): `docs/stack.md:156` lo deja fuera del MVP.
- Campanita global en el shell y contador de no leídas: se reconsidera con las notificaciones de stock bajo.
- Notificar por revocación/cambio de rol: el modelo queda listo (`type` + `payload`), pero la UI se hace cuando exista el caso.
