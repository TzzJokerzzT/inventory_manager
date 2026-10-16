# MI-45 — Asignar un usuario a una empresa con rol (INVITED)

## Objetivo

Permitir que un OWNER o ADMIN de una empresa invite a un usuario por email. Se crea un registro de membresía con estado `INVITED`. El usuario invitado podrá aceptar la invitación cuando inicie sesión o se registre (MI-46).

## Contexto

- La entidad `Membership` ya existe con roles (`OWNER`, `ADMIN`, `MEMBER`) y estados (`INVITED`, `ACTIVE`, `REVOKED`)
- El `MembershipRepository` actual solo tiene lecturas (`findActiveByUserAndCompany`, `findActiveByUser`)
- El `authorization.ts` ya tiene la matriz de reglas: `assign_member` (ADMIN/OWNER), `assign_admin` (OWNER), `assign_owner` (OWNER)
- El middleware `requireCompanyContext` ya valida membresía ACTIVE y resuelve el rol del caller

## Tareas

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Extender `MembershipRepository` con `invite()` y `InviteMemberInput` | `domain/repositories/membership-repository.ts` | done |
| 2 | Implementar `invite()` en `PrismaMembershipRepository` | `infrastructure/database/prisma-membership-repository.ts` | done |
| 3 | Agregar `findByEmailAndCompany()` (lectura para validar unicidad) | puerto + adaptador Prisma + in-memory | done |
| 4 | Crear use case `InviteMemberUseCase` | `application/use-cases/invite-member.ts` | done |
| 5 | Crear validator email + rol | `interfaces/http/validators/member-invite-validator.ts` | done |
| 6 | Agregar `inviteMember` al controller | `interfaces/http/controllers/company-controller.ts` | done |
| 7 | Registrar ruta `POST /companies/:companyId/members` | `interfaces/http/routes/company-routes.ts` | done |
| 8 | Documentar endpoint en OpenAPI | `apps/api/openapi.yaml` | done |
| 9 | Errores dedicados `InsufficientRoleError` (403) y `MembershipAlreadyExistsError` (409) + ramas en el error handler | `domain/errors/*`, `interfaces/http/middlewares/error-handler.ts` | done |
| 10 | Tests del use case | `apps/api/tests/invite-member.test.ts` | done |
| 11 | Tests del endpoint (integración) | `apps/api/tests/invite-member-endpoint.test.ts` | done |

## Criterios de aceptación

- [x] Un OWNER puede invitar como MEMBER, ADMIN u OWNER
- [x] Un ADMIN puede invitar como MEMBER (no ADMIN ni OWNER)
- [x] Un MEMBER no puede invitar a nadie (403 `insufficient_role`)
- [x] No se duplica una invitación (mismo email + empresa con status INVITED o ACTIVE) → 409 `membership_already_exists`
- [x] Un email con membresía REVOKED se puede volver a invitar
- [x] El email se normaliza a lowercase antes de persistir
- [x] El endpoint requiere autenticación y membresía ACTIVE en la empresa
- [x] Responde 201 con la membresía creada
- [x] Responde 403 si el caller no tiene permiso
- [x] Responde 400 si email o rol son inválidos

## Decisiones y desviaciones

1. **Errores dedicados en lugar de `DomainError` → 422.** El `errorHandler` mapea todo
   `DomainError` a 422. Un rechazo por rol es un 403 y una invitación duplicada es un 409,
   así que se crearon `InsufficientRoleError` (código `insufficient_role`) y
   `MembershipAlreadyExistsError` (código `membership_already_exists`), con sendas ramas en el
   handler. El código legible por máquina mantiene distinguible este 403 del
   `company_access_forbidden` uniforme.
2. **`ADMIN` no puede invitar a otro `ADMIN`.** Es la matriz vigente
   (`authorization.ts`: `assign_admin` sólo lo permite OWNER). Se dejó como está y se marcó como
   decisión a revisar en MI-47; el test lo fija explícitamente para que el cambio sea consciente.
3. **Normalización de email en el borde.** El validator hace `trim` y el controller aplica
   `toLowerCase()` antes de llamar al use case, que a su vez lo exige ya normalizado. La entidad
   `Membership` vuelve a normalizar (invariante de persistencia).
4. **La unicidad es por `(email, company)`**, no global: el mismo email puede estar invitado en
   dos empresas distintas.

## Evidencia

- `bun run test` (Jest, runner canónico del repo) → **32 suites, 265 tests, 0 fallos**
  - `tests/invite-member.test.ts` → 11 tests
  - `tests/invite-member-endpoint.test.ts` → 12 tests
  - `tests/openapi.test.ts` → reconciliación rutas↔operaciones OK con la ruta nueva
- `bun run check-types` → `api:check-types` OK. Los errores de `web:check-types` son
  preexistentes en `apps/web/lib/auth/validation.test.ts` (trabajo de registro sin commitear),
  fuera de esta superficie.
- `bunx biome check apps/api/src apps/api/tests` → limpio.

### Nota de entorno

`bun test` (runner de Bun) **no** es el runner del proyecto y da falsos fallos 429: comparte el
store en memoria del `apiRateLimiter` entre archivos, agotando el límite global de 100 requests.
El runner canónico es `bun run test` (Jest), que aísla el registro de módulos por archivo.

## Fuera de alcance

- MI-46: aceptar la invitación (`POST /me/invitations/accept`), según la decisión del usuario de
  usar un endpoint separado.
- MI-47: listar miembros, cambiar rol y revocar membresía; y la revisión de la regla
  ADMIN→ADMIN.
- Notificación por email al invitado (no existe infraestructura de email en el repo).
