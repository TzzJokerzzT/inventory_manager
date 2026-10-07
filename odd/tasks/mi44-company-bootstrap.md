# MI-44 — Registro abierto con email verificado y bootstrap de empresa propia

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-44 (`To Do` → al cerrar)

## Objetivo

Que un usuario recién registrado pueda **crear su primera empresa y quedar como `OWNER` `ACTIVE`** de
ella. Sin esto no puede existir ninguna empresa nunca.

## Criterios de MI-44, con su estado real

| Criterio | Estado |
|---|---|
| El registro exige `email_verified` de Auth0: sin email verificado no se completa el alta | ✅ **hecho en MI-53** (403 `email_not_verified`, sin tokens y sin fila) |
| Al crear la cuenta se crea la fila en `users` con `auth0_sub` y `email` | ✅ **hecho en MI-53** (`/userinfo` + upsert por `auth0_sub`) |
| **El usuario puede crear su primera empresa y queda con una membership `OWNER` `ACTIVE`** | ❌ **esto es MI-44** |
| Un usuario registrado sin empresa entra en el estado "sin empresas" | → **MI-48** (la tarea específica) |

## Lo que hay hoy, medido

- `POST /companies` crea una empresa **sin dueño**: no toca `memberships`. El `Company.owner_user_id`
  no existe a propósito (§5.8), así que hoy **una empresa creada no tiene ningún OWNER**.
- `GET /companies` devuelve **todas** las empresas de la base, sin filtrar por usuario. Con la
  autenticación ya cableada eso significa que **cualquier usuario autenticado ve las empresas de
  todos**, que es exactamente el riesgo que `docs/stack.md` §3.1 marca como el mayor del proyecto.
- La tabla `memberships` ya existe (migración `20261006223356_init`) con `invited_by` **NOT NULL**,
  `invited_email` **NOT NULL**, `UNIQUE (user_id, company_id)` y el `CHECK` de minúsculas sobre
  `invited_email`.
- No existe ninguna forma de saber **quién** es el usuario a partir del token: el `sub` viaja en
  `req.auth` pero nadie lo traduce a la fila de `users`.

## Diseño

### 1. Saber quién es el usuario (necesario, y declarado como frontera)

Un middleware `requireUser` que corre **después** de `requireAuth`: toma `req.auth.payload.sub`, busca
la fila en `users` con `UserRepository.findByAuth0Sub` y la deja disponible para el caso de uso. Si el
token es válido pero no hay fila, responde **403 con un código** (`user_not_provisioned`) en vez de
inventar un usuario: un token válido debería implicar una fila, porque sólo nuestra API emite tokens y
el gate de MI-53 la crea antes de emitirlos.

**Frontera declarada**: esto es la mitad "quién" de **MI-50**. La otra mitad —"a qué empresa puede
acceder y con qué rol, en cada request"— sigue siendo de MI-50. No la adelanto acá.

### 2. Una empresa nace con dueño (regla de dominio, no detalle técnico)

El puerto `CompanyRepository` cambia `create(company)` por **`createOwnedBy(company, owner)`**, donde
`owner` es `{ userId, email }`. No es una operación técnica: §5.8 dice que el dueño **es** la membership
con `role = OWNER`, así que "una empresa siempre nace con un dueño" es una regla del dominio.

El adaptador de Prisma lo hace en **una transacción**: crea la empresa y la membership
(`role = OWNER`, `status = ACTIVE`, `accepted_at = now()`). El *bootstrap* usa la **auto-referencia**
documentada en el esquema (`invited_by = user_id`): nadie te invitó, creaste tu propia empresa. El
`invited_email` va **en minúsculas**, que es lo que exige el `CHECK`.

El adaptador in-memory (el que usan los tests) refleja la misma regla, con un repositorio de
memberships en memoria.

### 3. Los endpoints

- `POST /companies` pasa a requerir token **y** usuario resuelto, y crea la empresa **con su OWNER**.
  El *bootstrap* no es un endpoint aparte: en el modelo A (§5.8) cualquiera crea empresas y queda como
  OWNER de cada una que crea (EMP-02).
- `GET /companies` pasa a devolver **sólo las empresas de las que el usuario es miembro**. Esto no es un
  extra: es la consecuencia inmediata de que existan memberships, y dejar la lista global al lado de
  ellas sería incoherente. **MI-50** extiende el mismo filtro a productos, clientes y movimientos.

## Tareas

- [ ] **T1 — Membership + `createOwnedBy`.** Entidad/puerto/adaptador de membership en memoria y en
  Prisma (transacción, OWNER + ACTIVE + auto-referencia), y el cambio del puerto de empresas.
  Superficies: `apps/api/src/domain/repositories/**`, `apps/api/src/infrastructure/database/**`.
- [ ] **T2 — `requireUser`.** Middleware + el error de usuario no provisionado, cableado en el
  composition root. Superficies: `apps/api/src/interfaces/http/middlewares/**`,
  `apps/api/src/interfaces/http/routes/**`, `apps/api/src/interfaces/http/app.ts`,
  `apps/api/src/main.ts`.
- [ ] **T3 — Endpoints.** `POST /companies` crea con dueño; `GET /companies` lista sólo las del
  usuario. Superficies: `apps/api/src/application/use-cases/**`,
  `apps/api/src/interfaces/http/controllers/company-controller.ts`.
- [ ] **T4 — Tests.** Bootstrap (crea empresa + membership OWNER ACTIVE), empresa de otro usuario no
  aparece en el listado, token sin fila en `users` → 403, y el puerto in-memory respetando la regla.
- [ ] **T5 — Documentación y Jira.** `docs/stack.md` §5.8, `README.md` si corresponde, y MI-44 en Jira.
- [ ] **T6 — Verificación contra el tenant y la base.** Con el usuario verificado: crear empresa por el
  endpoint, comprobar en `psql` la empresa **y** la membership OWNER ACTIVE, y que la lista devuelve
  sólo la propia. Limpiar las filas de prueba.

## Fuera de alcance

MI-48 (el estado "sin empresas" en la interfaz), MI-45 a MI-47 (asignar, aceptar y roles), MI-49 (el
invariante del último OWNER), MI-50 (validación de membership en cada request y aislamiento del resto de
los recursos), MI-4 (CRUD de empresas con datos fiscales y de contacto).

## Bitácora

- 2026-10-06 — Documento creado. Dos de los cuatro criterios ya estaban cumplidos por MI-53. Medido:
  `POST /companies` no crea dueño, `GET /companies` no filtra, y no hay forma de resolver el usuario
  desde el token.
