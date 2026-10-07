# MI-50 — Aislamiento por empresa en cada request + contexto de empresa

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-50 (`To Do`)

## Objetivo

Construir el **mecanismo** de aislamiento por empresa que `docs/stack.md:158-160` (§3.1) llama *el mayor
riesgo de seguridad del proyecto*: en cada request el servidor resuelve `auth0_sub → user_id`, valida
que el usuario tenga una membership `ACTIVE` en la empresa sobre la que opera, y resuelve su rol. Nada
de eso se confía al cliente.

**Alcance elegido por el usuario**: primitivo + contrato + tests, **más un endpoint de contexto de
empresa** para que la validación tenga un consumidor visible en la UI (y no sólo tests).

**Criterios**: viven en Jira y **no hay herramientas MCP de Atlassian en esta sesión**. Fuente local
autoritativa: `docs/stack.md` §5.8 — matriz de autorización `:596-605` e invariantes `:631-641` — más la
frontera ya declarada en `odd/tasks/mi44-company-bootstrap.md` ("MI-44 entrega la mitad *quién*; MI-50,
*a qué empresa y con qué rol*").

## Contexto medido

| Pieza | Estado |
|---|---|
| `require-auth` | ✅ `require-auth.ts:19`: valida el bearer contra el JWKS (401 vía `error-handler.ts:106-119`) |
| `require-user` | ✅ `require-user.ts:33-54`: resuelve `sub → users`, setea `request.user`, y **403 `user_not_provisioned`** si no hay fila (`error-handler.ts:96-104`) |
| Endpoints con empresa | ❌ **Sólo** `POST /companies` y `GET /companies` (`company-routes.ts:7-8`). No existen productos, clientes ni movimientos |
| `companyId` desde el cliente | ❌ **Nunca** se lee de params/body/query (grep sin matches). La única empresa es server-derived: `company-controller.ts:51` usa `user.id` |
| Entidad `Membership` | ❌ No existe (MI-44 no la creó a propósito: "nada la manipula todavía") |
| `GET /companies` | ✅ Ya filtra por membresía (`findAllForUser`) |

**Lo que esto implica**: hoy hay **poco que aislar**. El valor de MI-50 no está en tapar un agujero
abierto sino en dejar el mecanismo listo y probado antes de que MI-6/MI-7/MI-9 agreguen recursos.

## Decisiones de diseño

1. **El cliente sí dice sobre qué empresa opera; el servidor no le cree.** La lectura correcta de §5.8
   ("el `company_id` nunca se confía al cliente") no es ignorar el id que llega, sino **validar
   membership en cada request** para ese id. La forma concreta: `companyId` como **param de ruta**
   (`/companies/:companyId/...`).
2. **Entidad `Membership` + puerto `MembershipRepository`** (`findActiveByUserAndCompany(userId, companyId)`)
   con adaptador Prisma y adaptador in-memory, siguiendo el patrón ya establecido por
   `company-repository.ts` / `prisma-company-repository.ts` / `in-memory-company-repository.ts`. El
   in-memory existe para los tests sin base.
3. **`requireCompanyContext`**: middleware que toma `companyId` del param, resuelve la membership
   `ACTIVE` y setea `request.companyContext = { companyId, role }` con la aumentación `declare global`
   (mismo criterio que `require-user.ts:14-20`: es identidad del request, no estado de la respuesta).
4. **403 uniforme para "no existe" y "no sos miembro"**: distinguirlos convierte el endpoint en un
   oráculo de qué empresas existen (enumeración entre tenants). Es el mismo criterio de errores
   uniformes que MI-52 aplicó a credenciales. Un `companyId` con formato inválido sí es 400.
5. **La matriz de autorización es una función pura**, no middleware: `can(role, action)`, con las filas
   de `docs/stack.md:596-605`, incluidas las dos que se olvidan siempre — **nadie cambia su propio rol**
   (ni el OWNER) y **salir** está permitido salvo para el último `OWNER` activo. Se testea sin HTTP,
   porque los endpoints de gestión de miembros son de MI-45/MI-47 y todavía no existen.
6. **Endpoint de contexto**: `GET /companies/:companyId/context` → `200 { company, role }` si hay
   membership `ACTIVE`; **403 uniforme** en cualquier otro caso. Es el consumidor visible del primitivo
   y lo que el switch de empresa puede usar para validar su selección.
7. **`GET /companies` no cambia**: ya devuelve sólo las propias. `POST /companies` tampoco: no hay
   contexto de empresa en el alta (la empresa **nace** con su membership `OWNER`, MI-44).
8. **El middleware queda listo para colgarse de `/companies/:companyId/*`** en MI-6/7/9, y se documenta
   así para que el próximo que agregue un recurso no invente otro camino.

## Unidades de trabajo

- [x] **U1 — Membership.** ✅ Commit `500028e` (`feat(api): model memberships and resolve an active one`).
  Entidad que espeja la tabla (`userId` nullable a propósito, `invitedEmail` en minúsculas, `role`/`status`
  como uniones del dominio), puerto con **una sola** consulta y dos adaptadores que filtran duro
  `status: "ACTIVE"`. **Sin migración**: la tabla ya existía con su CHECK y su `@@unique([userId,
  companyId])`. **Spot check del padre**: 21 suites / 148 tests.
- [ ] **U2 — Primitivo + contexto (delegada, test-first)**: `requireCompanyContext`, la matriz `can(role,
  action)` con sus dos reglas finas, `GET /companies/:companyId/context` con 403 uniforme, y tests de
  integración con el JWKS local y el repositorio falso. **Incluye dos correcciones que deja la verificación
  de U1**: (a) el test "an INVITED membership does not grant access" del adaptador in-memory **pasa por la
  razón equivocada** — crea la fila con `userId: null` pero consulta `("user-1", "company-1")`, así que el
  desajuste de `userId` ya devuelve null y el test pasaría igual **sin** el filtro de status
  (`in-memory-membership-repository.test.ts:49-65`); hay que darle un `userId` que coincida para que sea una
  prueba real del filtro, porque hoy la única guardia del rechazo de `INVITED` es la aserción de argumentos
  del test de Prisma; (b) comentario obsoleto en `in-memory-company-repository.ts:10` ("MI-45 introduces the
  real entity when it needs one"), que quedó viejo con este commit.

## Verificación de U1 (independiente, `gentle-ai-verify`)

**Claims 1-7 PASS; el octavo trae un hallazgo real (test débil, no bug de código).** Gates re-ejecutados y
recontados a mano por el verificador: 21 suites / 148 tests (17 nuevos: 9+5+3), `check-types` exit 0, lint
exit 0 sobre 172 archivos. Pureza del dominio confirmada (imports de `domain/` sólo al error propio; los
enums del dominio son value-identical a los de Prisma, probado porque `tsc` acepta el paso directo).

**El filtro está bien guardado donde importa**: el test del adaptador Prisma usa
`toHaveBeenCalledWith({ where: { userId, companyId, status: "ACTIVE" } })`, que es **forma exacta**, no
match laxo: quitar `status` cambia el conteo de claves y el matcher falla. El verificador rastreó el
matcher en `expect` para probarlo, en vez de asumirlo.

**Divergencia entre adaptadores: equivalente** en multi-empresa (el índice único hace determinista el
`findFirst` sin orden), en `userId` nulo (inalcanzable por el puerto, que toma `string`) y en el case del
email (ninguno consulta por email; el CHECK de la base prohíbe el estado que el in-memory no puede
representar).

**Residuales declarados, sin consumidor hoy**: (1) el adaptador in-memory devuelve **la misma instancia**
y `save` guarda el objeto del caller, mientras la entidad entrega `Date`s mutables → un test podría mutar
estado almacenado, cosa que el adaptador Prisma nunca permite; severidad baja, se anota. (2) Nada en `src/`
consume todavía `findActiveByUserAndCompany` (esperado en U1): el puerto no está probado de punta a punta.

## Fuera de alcance

MI-45 (asignar con rol) · MI-46 (aceptar asignación) · MI-47 (endpoints de gestión de miembros) ·
MI-49 (invariante del último OWNER **aplicada a un endpoint**; acá vive como regla de la matriz) ·
MI-6/MI-7/MI-9 (los recursos que se aislarán después) · MI-55 (rate limit) · Row Level Security, que el
proyecto decidió no usar (`docs/stack.md:158`).

## Ruta y presupuesto

**Ruta**: delegada (`gentle-ai-worker`) en dos unidades. Trigger: multi-file write en cada una.
**Test-first**: aplicable (Jest con JWKS local, sin red). **Presupuesto**: ~300–400 líneas por unidad.

## Bitácora

- 2026-10-07 — Documento creado. Exploración confirmada: `companyId` nunca llega del cliente, no existe
  ningún recurso por empresa, y no hay entidad `Membership`. Decisión del usuario: entregar el primitivo
  **más** el endpoint de contexto.
- 2026-10-07 — **U1 hecha y verificada** (commit `500028e`): claims 1-7 PASS y **un hallazgo real en el
  octavo** — el test de rechazo de `INVITED` del adaptador in-memory **pasa por la razón equivocada**
  (desajuste de `userId` en vez del filtro de status). No es un bug de código: es una guardia que no
guarda. Se corrige en U2 junto con el comentario obsoleto, para no abrir un ciclo de verificación
  independiente por una línea de test.
