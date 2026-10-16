# MI-47 — Reglas de autorización por rol y gestión de miembros

## Objetivo

Exponer la matriz de autorización de `docs/stack.md` §5.8 en endpoints de gestión de miembros:
listar, cambiar rol, revocar y salir de la empresa. Cubre **EMP-09** (el listado de usuarios muestra
sólo los vinculados a las empresas del propio usuario) y **EMP-10** (salir, salvo el último OWNER
activo).

## Contexto

- `authorization.ts` ya implementa la matriz completa: `assign_member`, `assign_admin`,
  `assign_owner`, `change_own_role`, `leave` (con `isLastActiveOwner`), `create_company`,
  `view_users`.
- MI-45 dejó `MembershipRepository` con `invite()`, `findByEmailAndCompany()`; MI-46 sumó
  `findInvitedByEmail()` y `accept()`.
- `requireCompanyContext` ya resuelve `{ companyId, role }` de una membresía `ACTIVE`, así que los
  endpoints nuevos heredan el aislamiento por empresa sin trabajo extra.
- Filas de §5.8 que estos endpoints aplican:
  | Acción | Quién puede |
  | --- | --- |
  | Asignar o quitar `MEMBER` | ADMIN u OWNER |
  | Asignar o quitar `ADMIN` | **OWNER** |
  | Asignar o quitar `OWNER` | **OWNER** |
  | Cambiar el propio rol | **nadie** |
  | Salir | cualquiera, salvo el último OWNER **activo** |
  | Ver usuarios | sólo los de sus empresas |

## Endpoints

| Método y ruta | Qué hace | Quién |
| --- | --- | --- |
| `GET /companies/:companyId/members` | Lista la dotación de la empresa (`ACTIVE` + `INVITED`, nunca `REVOKED`) | Cualquier miembro (`view_users`) |
| `PATCH /companies/:companyId/members/:membershipId` | Cambia el rol de una membresía | Según rol viejo y nuevo |
| `DELETE /companies/:companyId/members/:membershipId` | Revoca una membresía (`status = REVOKED`) | Según el rol de la membresía |
| `DELETE /companies/:companyId/members/me` | El caller sale de la empresa (EMP-10) | Cualquiera, salvo último OWNER activo |

## Tareas

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `assignmentActionForRole()` en las políticas (una sola fuente para asignar/quitar) | `domain/policies/authorization.ts` | pending |
| 2 | `MembershipNotFoundError` (404) y `LastActiveOwnerError` (409) | `domain/errors/*` | pending |
| 3 | Puerto: `findByCompany()`, `findById()`, `updateRole()`, `revoke()`, `countActiveOwners()` | `domain/repositories/membership-repository.ts` | pending |
| 4 | Adaptadores Prisma e in-memory de los cinco métodos | `infrastructure/database/*membership-repository.ts` | pending |
| 5 | Use cases `ListMembers`, `ChangeMemberRole`, `RevokeMembership`, `LeaveCompany` | `application/use-cases/*` | pending |
| 6 | Refactor de `InviteMemberUseCase` para usar `assignmentActionForRole()` | `application/use-cases/invite-member.ts` | pending |
| 7 | Validator del cambio de rol | `interfaces/http/validators/member-role-validator.ts` | pending |
| 8 | Controller: `listMembers`, `changeMemberRole`, `revokeMember`, `leaveCompany` | `interfaces/http/controllers/company-controller.ts` | pending |
| 9 | Rutas (declarar `/members/me` **antes** de `/members/:membershipId`) | `interfaces/http/routes/company-routes.ts` | pending |
| 10 | Ramas nuevas del error handler | `interfaces/http/middlewares/error-handler.ts` | pending |
| 11 | OpenAPI | `apps/api/openapi.yaml` | pending |
| 12 | Wiring en `app.ts` + `main.ts` (y stub de `openapi.test.ts`) | varios | pending |
| 13 | Tests unitarios de los cuatro use cases | `apps/api/tests/*` | pending |
| 14 | Tests de integración de los cuatro endpoints | `apps/api/tests/*` | pending |

## Reglas de decisión

1. **Quitar exige el mismo permiso que asignar.** Cambiar `ADMIN` → `MEMBER` requiere `assign_member`
   *y* `assign_admin` (quitar ADMIN es de OWNER), así que un ADMIN no puede degradar a otro ADMIN.
2. **Nadie cambia su propio rol** (`change_own_role`): `PATCH` sobre la propia membresía es 403
   `insufficient_role`. Mata la auto-escalada.
3. **`DELETE` sobre la propia membresía se trata como salir**, no como revocar a otro: aplica
   `leave` con el guard de último OWNER. La ruta `/members/me` es el camino explícito para EMP-10.
4. **Invariante del último OWNER activo** (fall-closed): si una operación le quita el `OWNER` a una
   membresía `ACTIVE`, se exige que quede ≥1 OWNER activo; si no, 409 `last_active_owner`. Una
   membresía `INVITED` con rol OWNER no cuenta como OWNER activo, así que cambiarle el rol no la
   toca. MI-49 generaliza el invariante; acá se cierra el agujero que abrirían estos endpoints.
5. **No se enumeran membresías de otras empresas:** un `membershipId` que no pertenece a la empresa
   del contexto es 404 `membership_not_found`, indistinguible de uno inexistente.
6. **Una membresía `REVOKED` no se ve ni se toca:** no aparece en el listado y `PATCH`/`DELETE` sobre
   ella es 404.
7. **Cambiar el rol al que ya tiene es no-op idempotente** (200 con la membresía intacta).

## Criterios de aceptación

- [ ] Cualquier miembro ACTIVE (incluido MEMBER) lista la dotación de su empresa
- [ ] El listado incluye `INVITED` y `ACTIVE`, y nunca `REVOKED`
- [ ] Un OWNER asigna/quita ADMIN y OWNER; un ADMIN sólo MEMBER (y no puede tocar a un ADMIN/OWNER)
- [ ] Un MEMBER no puede cambiar roles ni revocar a nadie
- [ ] Nadie cambia su propio rol (403)
- [ ] Un ADMIN no puede degradar a otro ADMIN (403), porque quitar ADMIN es de OWNER
- [ ] Revocar el último OWNER activo es 409 `last_active_owner`; con ≥2 OWNER activos, un OWNER puede
      revocar a otro OWNER
- [ ] Salir de la empresa funciona, salvo para el último OWNER activo
- [ ] `?membershipId` de otra empresa es 404
- [ ] 401 sin token, 403 `company_access_forbidden` sin membresía activa

## Evidencia

- `bun run test` (Jest, runner canónico) → **36 suites, 332 tests, 0 fallos**
  - `tests/member-management.test.ts` → 31 tests unitarios (los cuatro use cases)
  - `tests/member-management-endpoint.test.ts` → 19 tests de integración
  - `tests/openapi.test.ts` → reconciliación rutas↔operaciones OK con las cuatro rutas nuevas
- `bun run check-types` → **2/2 paquetes OK**
- `bunx biome check apps/api/src apps/api/tests` → limpio

### Decisiones de verificación que vale la pena leer

- **El guard del último OWNER se probó con un store que dice "queda uno".** Con un roster
  consistente el guard es *inalcanzable*: si el caller es OWNER, ya hay ≥2 OWNER activos, así que
  quitarle el rol a otro OWNER nunca deja cero. Se vuelve alcanzable con una revocación concurrente
  (el contexto del caller se resolvió y después lo revocaron), y por eso se ejercita con un store
  donde `countActiveOwners()` devuelve 1. El caso **realmente** alcanzable es salir siendo el último
  OWNER, y ese está cubierto de punta a punta por HTTP: `409 last_active_owner`.
- **Un test unitario mío estaba mal planteado y se corrigió, no se silenció**: "un MEMBER no puede
  revocar" apuntaba a la propia membresía del MEMBER, que es el camino de *salir* (permitido). Ahora
  apunta a otro miembro, que es donde la matriz deniega.

## Deuda que sigue abierta

- **`InMemoryCompanyRepository` no puede representar más de un miembro por empresa.** Estos
  endpoints no lo necesitan (leen membresías por `MembershipRepository`), pero `GET /me` y
  `GET /companies/:id/context` en tests siguen limitados por eso.
- **El listado no trae nombres**: devuelve `invitedEmail`, no `fullName`, porque enriquecerlo exige
  un join contra `users` que este slice no abre.

## Fuera de alcance

- Nombres para mostrar en el listado: requiere un join contra `users` (el listado devuelve
  membresías con `invitedEmail`). Se declara como límite, no se esconde.
- MI-49: generalización del invariante del último OWNER en el CRUD de empresas.
- UI de gestión de miembros (Fase 2/3, vistas MI-2x).
