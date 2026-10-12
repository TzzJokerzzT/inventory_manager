# Gestión de miembros en el frontend

## Objetivo

Cablear los endpoints de membresías (backend ya completo: MI-45/46/47, commit `a191bbb`) a la
interfaz: listar el roster de la empresa activa, invitar, cambiar rol, revocar, salir de la empresa y
—del lado del invitado— aceptar una invitación pendiente.

## Decisiones del usuario

1. **Vive dentro de `/dashboard/user`**, como sección más de la página. No hay ruta ni entrada de nav
   nuevas (no existe mockup para esta vista).
2. **Incluye el lado del invitado**: botón "Aceptar invitación pendiente" en `/sin-empresas`, que llama
   a `POST /me/invitations/accept` y refresca el estado.

## Contexto del contrato

`GET /me` sólo devuelve membresías `ACTIVE`, así que el cliente **no puede ver** que tiene una
invitación pendiente: la única forma de enterarse es llamar al endpoint de aceptación y ver si
devuelve algo. Eso es exactamente lo que hace el botón.

| Endpoint | Cuerpo | Respuesta | Errores con `code` |
|---|---|---|---|
| `GET /companies/{companyId}/members` | — | `Membership[]` (`ACTIVE` + `INVITED`) | `company_access_forbidden` |
| `POST /companies/{companyId}/members` | `{ email, role }` | `201 Membership` | `insufficient_role`, `membership_already_exists` |
| `PATCH /companies/{companyId}/members/{membershipId}` | `{ role }` | `200 Membership` | `insufficient_role`, `membership_not_found`, `last_active_owner` |
| `DELETE /companies/{companyId}/members/{membershipId}` | — | `200 Membership` (`REVOKED`) | `insufficient_role`, `membership_not_found`, `last_active_owner` |
| `DELETE /companies/{companyId}/members/me` | — | `200 Membership` (`REVOKED`) | `last_active_owner` |
| `POST /me/invitations/accept` | — | `Membership[]` (puede ser `[]`) | — |

**Reglas de la matriz (§5.8) que la UI refleja** (el servidor sigue siendo la autoridad, la UI sólo
esconde lo que va a fallar):
- `MEMBER`: sólo lectura.
- `ADMIN`: invita y quita `MEMBER`; no puede tocar `ADMIN` ni `OWNER`.
- `OWNER`: todo.
- **Nadie cambia su propio rol**, ni el OWNER.
- Salir: cualquiera, salvo el último OWNER activo.

**Límite declarado:** el roster trae `invitedEmail`, **no nombres**. El backend todavía no hace el join
contra `users` (deuda anotada en MI-47).

## Tareas

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `membershipSchema` + `parseMembershipsResponse` + `parseMembership` | `lib/api/schemas.ts` | done |
| 2 | Hooks: `use-members`, `use-invite-member`, `use-change-member-role`, `use-revoke-member`, `use-leave-company` | `src/features/member/api/` | done |
| 3 | Hook `use-accept-invitations` | `src/features/member/api/` | done |
| 4 | Selector puro de permisos espejando la matriz | `src/features/member/lib/member-permissions.ts` | done |
| 5 | Tabla del roster + acciones por fila | `src/features/member/components/` | done |
| 6 | Formulario de invitación (email + rol) | `src/features/member/components/invite-member-form.tsx` | done |
| 7 | Sección montada en la página de usuario | `src/features/user/components/user.tsx` | done |
| 8 | Acción de aceptar invitación en el estado sin empresas | `src/features/company/components/no-companies-state.tsx` | done |
| 9 | Arreglar el título equivocado del header ("Clientes" → "Usuario") | `src/features/user/components/user.tsx` | done |
| 10 | Tests: hooks, selector, tabla, formulario, aceptar | `src/features/member/**/__tests__/` | done |
| 11 | Adaptar los tests de los dos componentes anfitriones (provider/mocks) | `src/features/company/__tests__/*`, `src/features/user/components/__tests__/full-name-form.test.tsx` | done |

**Corrección de la tarea 8:** el doc apuntaba a `src/features/auth/sin-empresas/components/sin-empresas.tsx`, pero el
estado sin empresas lo renderiza `NoCompaniesState` (el gate sólo decide *si* mostrarlo). La acción se montó
donde corresponde.

## Criterios de aceptación

- [ ] La sección lista el roster de la **empresa activa** (no de otra)
- [ ] Un `MEMBER` ve la tabla sin acciones; un `ADMIN` no ve acciones sobre `ADMIN`/`OWNER`
- [ ] Invitar muestra el mail y el rol, y traduce `membership_already_exists` a un mensaje legible
- [ ] Cambiar rol y revocar piden confirmación y refrescan la tabla
- [ ] "Salir de la empresa" deshabilitado para el último OWNER activo, y muestra el 409 si igual falla
- [ ] `INVITED` se distingue de `ACTIVE` en la tabla
- [ ] En `/sin-empresas`, aceptar una invitación lleva al usuario al dashboard (invalida `["companies"]`)
- [ ] Aceptar sin invitaciones pendientes muestra "no tenés invitaciones" y no rompe
- [ ] Tests verdes, `check-types` y `lint` en verde

## Evidencia

- `cd apps/web && bun run test` → **54 suites / 332 tests, 0 fallos**
- `cd apps/web && bun run check-types` → OK (next typegen + tsc check + cypress tsc)
- `bunx biome check apps/web` → 178 archivos, sin errores

### Decisiones y desviaciones declaradas

1. **Los tests de los componentes anfitriones hubo que tocarlos.** Montar la sección y la acción de aceptar
   hace que `user.tsx` y `no-companies-state.tsx` rendericen hooks de React Query, y sus tests los montaban
   sin provider: 7 tests en 3 suites pasaron a fallar con "No QueryClient set". Se agregó el provider (y un
   `jest.mock` de `MembersSection` en `full-name-form.test.tsx`, donde un provider solo no alcanzaba porque
   dispararía requests reales). **Ninguna aserción existente se debilitó ni se borró**; en
   `no-companies-state.test.tsx` se *agregó* una.
2. **Cambiar rol es OWNER-only en la UI**, más estricto que el servidor. Un ADMIN sólo puede asignar `MEMBER`
   y no puede quitar `ADMIN`, así que las únicas transiciones que le quedan son no-ops: la UI no ofrece un
   control que no puede llegar a nada.
3. **Sin RED observado** en las unidades nuevas: los tests se escribieron junto con la implementación y se
   vieron verdes en la primera corrida. Se declara, no se esconde.
4. **Sección fuera de la card de perfil**, como segunda card `max-w-4xl`, para que la tabla tenga ancho.

### Nota de producto

La sección de miembros vive en la página **Usuario** (decisión del usuario). Mezcla perfil personal con
administración de la empresa activa; si más adelante el producto quiere separarlo, el código ya está aislado
en `src/features/member/` y sólo cambia el punto de montaje.

## Fuera de alcance

- UI de miembros como módulo propio con ruta/nav (decisión del usuario).
- Nombres en el roster (requiere cambio de backend).
- Paginación, búsqueda y orden del roster: el backend devuelve la empresa entera.
