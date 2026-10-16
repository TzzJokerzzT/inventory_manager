# MI-46 — Aceptar la asignación pendiente

## Objetivo

Permitir que un usuario autenticado convierta en `ACTIVE` las membresías `INVITED` que apuntan a su
propio email. Decisión del usuario: **endpoint separado**, no aceptación automática dentro de
login/registro. El cliente lo llama después de autenticarse.

## Contexto

- MI-45 (commit `0a5b81f`) ya crea membresías `INVITED` y expone `POST /companies/:companyId/members`.
- La entidad `Membership` ya modela `userId: null` + `status: INVITED` + `acceptedAt: null`.
- `requireCompanyContext` sólo resuelve membresías `ACTIVE`, así que una invitación sin aceptar no da
  acceso a la empresa: aceptar es lo que habilita el `companyId` en el contexto.
- `User.email` ya viene normalizado a lowercase por la entidad, y `memberships.invited_email` también
  (CHECK en la base). El join por email es entonces directo.
- El endpoint vive en el router de `/me` (identidad, sin `requireCompanyContext`), igual que
  `GET /me` y `PATCH /me`.

## Tareas

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Agregar `findInvitedByEmail()` y `accept()` al puerto | `domain/repositories/membership-repository.ts` | pending |
| 2 | Implementar ambos en el adaptador Prisma (update guardado por `status: INVITED`) | `infrastructure/database/prisma-membership-repository.ts` | pending |
| 3 | Implementar ambos en el adaptador in-memory | `infrastructure/database/in-memory-membership-repository.ts` | pending |
| 4 | Crear `AcceptInvitationsUseCase` | `application/use-cases/accept-invitations.ts` | pending |
| 5 | Agregar `acceptInvitations` al `MeController` | `interfaces/http/controllers/me-controller.ts` | pending |
| 6 | Registrar `POST /me/invitations/accept` | `interfaces/http/routes/me-routes.ts` | pending |
| 7 | Wiring en `app.ts` + `main.ts` | `interfaces/http/app.ts`, `main.ts` | pending |
| 8 | Documentar endpoint en OpenAPI | `apps/api/openapi.yaml` | pending |
| 9 | Tests del use case | `apps/api/tests/accept-invitations.test.ts` | pending |
| 10 | Tests del endpoint (integración, incluye idempotencia y aislamiento por email) | `apps/api/tests/accept-invitations-endpoint.test.ts` | pending |

## Contrato

`POST /me/invitations/accept` — sin body.

- **200**: array (posiblemente vacío) de las membresías que quedaron `ACTIVE`. Vacío cuando no había
  nada pendiente: el endpoint es **idempotente** y seguro de llamar en cada login.
- **401**: sin token.
- **403** `user_not_provisioned`: el token no resuelve a una fila de usuario.
- Sólo se aceptan membresías `INVITED` cuyo `invited_email` sea el email del caller. Una membresía
  `REVOKED` o de otro email nunca se toca.

## Decisiones

1. **Acepta todas las pendientes del email, no una por id.** El cliente no necesita conocer ids de
   invitación y el resultado es idempotente. El subject es implícito (`requireUser`), así que el
   caller nunca puede nombrar el email de otro por body o path.
2. **Sin error cuando no hay nada pendiente.** Devolver 404/409 obligaría al cliente a tratar el
   caso normal como error; vacío es la respuesta honesta.
3. **`accept()` guardado por `status: INVITED`** (`updateMany` + `count`), no un `update` a ciegas:
   si una revocación ocurre entre la lectura y la escritura, la carrera no revive la membresía.
   Devuelve `null` cuando no actualizó nada y el use case simplemente la saltea.
4. **El email ya está normalizado**: `User.email` es lowercase por invariante de entidad, y
   `invited_email` lo es por CHECK. No se agrega una normalización extra que pueda divergir.

## Criterios de aceptación

- [ ] Un usuario con invitación pendiente la convierte en `ACTIVE` y gana acceso a la empresa
      (`GET /companies/:companyId/context` pasa a 200)
- [ ] Tras aceptar, `acceptedAt` y `userId` quedan seteados
- [ ] Una invitación de otro email no se acepta
- [ ] Una membresía `REVOKED` no se acepta
- [ ] Segunda llamada devuelve `[]` (idempotente)
- [ ] 401 sin token; 403 `user_not_provisioned` sin fila de usuario
- [ ] `POST /me/invitations/accept` no requiere membresía previa en ninguna empresa

## Evidencia

- `bun run test` (Jest, runner canónico) → **34 suites, 282 tests, 0 fallos**
  - `tests/accept-invitations.test.ts` → 9 tests
  - `tests/accept-invitations-endpoint.test.ts` → 9 tests
  - `tests/openapi.test.ts` → reconciliación rutas↔operaciones OK con la ruta nueva
- `bun run check-types` → **2/2 paquetes OK**
- `bunx biome check apps/api/src apps/api/tests` → limpio

### Límite declarado de la verificación

El criterio "gana acceso a la empresa" se verifica en dos partes, no con un solo request a
`/context`:

1. sobre HTTP, una ruta con contexto de empresa (`POST /companies/:companyId/media/signature`)
   pasa de 403 `company_access_forbidden` a 200 después de aceptar, que es exactamente el portón
   `requireCompanyContext`;
2. el estado que `GET /me` proyecta se verifica contra el puerto (`findActiveByUser`), no por HTTP.

Motivo: `InMemoryCompanyRepository` guarda un roster estático con **una sola membresía por
empresa** (clave `companyId`), mientras que `PrismaCompanyRepository.findAllForUser` lee la tabla
de membresías viva con `status: "ACTIVE"`. En producción, el mismo accept hace aparecer la empresa
en `/context` y en `/me` sin trabajo extra; el doble in-memory no puede representar una empresa con
varios miembros. Ampliarlo (clave compuesta + filtro de status) es trabajo de **MI-47**, que
necesita listar miembros de todos modos.

## Deuda detectada

- `InMemoryCompanyRepository` no puede representar más de un miembro por empresa ni distinguir
  `INVITED`/`REVOKED`. Queda para MI-47, que además es el que introduce listar miembros.

## Fuera de alcance

- Notificación por email al invitado.
- Aceptación automática dentro de login/registro (descartada por decisión del usuario).
- MI-47: listar miembros, cambiar rol, revocar.
