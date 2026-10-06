# MI-38 — Prisma + Supabase (incluye MI-51)

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-38, MI-51

## Objetivo

Dejar la capa de datos real: `schema.prisma` como fuente de verdad, la conexión al pooler de
Supabase, la primera migración aplicada y el cliente Prisma usable desde la Clean Architecture.

Hoy verificado: `apps/api/prisma/` no existe, `prisma` no está en `bun.lock` ni en
`node_modules/.bin`, y `apps/api/.env` ya tiene `DATABASE_URL` y `DIRECT_URL` apuntando al proyecto
de Supabase aprovisionado.

## Evidencia del entorno (medida, no supuesta — 2026-10-06)

| Verificación | Resultado |
|---|---|
| Rol de conexión | `prisma` — `rolcreatedb = true`, `rolbypassrls = true`, no superuser |
| Host / base | `aws-1-us-east-2.pooler.supabase.com` / `postgres` |
| `DATABASE_URL` | puerto 6543 con `?pgbouncer=true` — alcanzable (TCP OK) |
| `DIRECT_URL` | session pooler puerto 5432, sin parámetros — alcanzable (TCP OK), es la de migraciones |
| Versión de PostgreSQL | **17.6** (`server_version_num` 170006) |
| `pg_trgm` | disponible (1.6), **no instalada** |
| `pgcrypto` / `uuid-ossp` | instaladas (no hacen falta: `gen_random_uuid()` es core en PG 13+) |
| Auth0 | las 5 variables presentes en `.env` |

## Decisiones del usuario (2026-10-06)

1. **`pg_trgm`: activarla ahora**, en la primera migración.
2. **Alcance del schema: dominio completo** — `Company`, `User`, `Membership`, `Category`,
   `Product`, `Customer`, `StockMovement` y los enums.
3. **Aplicar la migración contra el Supabase real** ahora.
4. **Prisma `7.10.0`** fijado (el dist-tag `latest` de npm hoy es `8.0.0-rc.20`, un release candidate;
   el último estable es 7.10.0).
5. **`categoría` se modela como tabla `Category` por empresa** (`UNIQUE (company_id, name)`), con
   `Product.category_id` nullable. Cierra el hueco: `PROD-04` y `DASH-02` la piden y
   `docs/Project.md` §Entidades no la tenía.
6. **El adaptador `PrismaCompanyRepository` entra en MI-38** y se cablea en el composition root.

## Consecuencias de Prisma 7 (cambian lo que dice `docs/stack.md`)

| Tema | v6 (lo que asume stack.md §3.3) | v7 (lo que hacemos) |
|---|---|---|
| URL del datasource | `url` + `directUrl` en el schema | `prisma.config.ts` con `datasource.url = env("DIRECT_URL")` para CLI/migraciones |
| Cliente en runtime | `prisma-client-js` desde `node_modules` | `prisma-client` generado con `output` obligatorio + `@prisma/adapter-pg` con la URL del pooler |
| Extensiones | preview feature `postgresqlExtensions` | migración editada a mano (`CREATE EXTENSION`) — el flag se deprecó en 6.16 |
| CHECK constraints | no modelables | SQL a mano en la migración |

Datos verificados en la documentación oficial (`prisma.io/docs/orm/v7/...`): `directUrl` fue
**removido** en v7; el provider `prisma-client-js` está en salida; el `output` es obligatorio; y
para Supabase/pooler la doc indica configurar el CLI con la URL directa y el cliente con un driver
adapter sobre la URL pooled.

## Diseño de registro: `apps/api/prisma/schema.prisma`

Reglas que vienen de `docs/stack.md` §3.2 y hay que respetar literalmente:

- `uuid` como PK con default **en la base**: `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`.
- `UNIQUE (company_id, sku)` — SKU único por empresa, nunca global.
- Dinero en `Decimal @db.Decimal(12, 2)` — nunca `float`.
- `CHECK (stock_quantity >= 0)` y `CHECK (quantity > 0)` → SQL a mano en la migración.
- Borrado lógico con `deleted_at` en `products` y `customers`.
- `auth0_sub` UNIQUE; **sin** `password_hash`.
- `Company` **sin** `owner_user_id`: el dueño es la membership con `role = OWNER`.
- `Membership.user_id` **nullable** a propósito (la asignación existe antes que la cuenta) y
  `UNIQUE (user_id, company_id)`.
- Revocar es `status = REVOKED`, nunca `DELETE`.

### Dos desviaciones documentadas (no silenciosas)

1. **`StockMovement` sin `updated_at`.** `docs/Project.md` §Entidades lo lista, pero §3.2 dice que
   `stock_movements` es **inmutable** y `MOV-05` pide auditoría de creación (`created_at` + `user_id`).
   Una fila inmutable con `updated_at` se contradice: se implementa inmutable y se corrige el bloque
   de entidades de `docs/Project.md`.
2. **`Membership.invited_by` NOT NULL con auto-referencia en el bootstrap.** §5.8 lo define NOT NULL.
   Cuando el primer usuario crea su propia empresa (MI-44) no hay tercero que lo invite: la membership
   `OWNER` se crea con `invited_by = user_id` (se invita a sí mismo). Se registra acá para que MI-44
   no lo reinterprete. Hacerlo nullable sería una alternativa, pero se prefiere no divergir de §5.8.

### Modelos

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/infrastructure/database/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

- `Company` — `id`, `name`, `tax_id?`, `address?`, `phone?`, `created_at`, `updated_at`.
- `User` — `id`, `auth0_sub` UNIQUE, `email` UNIQUE, `full_name?`, `created_at`, `updated_at`.
- `Membership` — `id`, `user_id?`, `invited_email`, `company_id`, `role`, `status`
  (`@default(INVITED)`), `invited_by`, `accepted_at?`, timestamps; `@@unique([user_id, company_id])`,
  `@@index([invited_email, status])`.
- `Category` — `id`, `company_id`, `name`, timestamps; `@@unique([company_id, name])`.
- `Product` — `id`, `company_id`, `name`, `description?`, `sku`, `price` `Decimal(12,2)`,
  `photo_url?`, `stock_quantity Int @default(0)`, `low_stock_threshold Int @default(0)`,
  `category_id?`, timestamps, `deleted_at?`; `@@unique([company_id, sku])`,
  `@@index([company_id, deleted_at])`, `@@index([company_id, category_id])`.
- `Customer` — `id`, `company_id`, `name`, `email?`, `phone?`, `address?`, timestamps,
  `deleted_at?`; `@@index([company_id, deleted_at])`.
- `StockMovement` — `id`, `company_id`, `product_id`, `type` (`IN`|`OUT`), `quantity`,
  `reason?`, `user_id`, `customer_id?`, `created_at`; `@@index([company_id, product_id, created_at])`,
  `@@index([company_id, customer_id])`.
- Enums: `MembershipRole`, `MembershipStatus`, `StockMovementType`.
- Todas las tablas con `@@map` a snake_case plural; todas las columnas con `@map` a snake_case.

## Tareas

- [ ] **T1 — Dependencias y scripts.** `prisma@7.10.0`, `@prisma/client@7.10.0`, `@prisma/adapter-pg`,
  `pg` (dep) + `@types/pg` (dev) en `apps/api`. Scripts: `db:generate`, `db:migrate`, `db:deploy`,
  `db:status`, `db:studio`. `postinstall` → `prisma generate` (no necesita base ni conexión).
  Superficies: `apps/api/package.json`, `bun.lock`.
- [ ] **T2 — `prisma.config.ts` + `schema.prisma`.** Config con `schema`, `migrations.path` y
  `datasource.url = env("DIRECT_URL")`; schema completo según el diseño de arriba. Cierra cuando
  `prisma validate` y `prisma generate` pasan y `check-types` queda limpio.
  Superficies: `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma`, `biome.json`, `.gitignore`.
- [ ] **T3 — Cliente singleton.** `src/infrastructure/database/prisma-client.ts`: factory
  `createPrismaClient(connectionString?)` con `PrismaPg` y error explícito si falta `DATABASE_URL`.
  Ver: `@prisma/adapter-pg` + URL **pooled**. Superficies: `apps/api/src/infrastructure/database/prisma-client.ts`.
- [x] **T4 — Primera migración aplicada.** ✅ `20261006223356_init`, aplicada contra Supabase.
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;` al inicio (línea 3) y las cuatro `CHECK` dentro de los
  `CREATE TABLE` (`products_stock_quantity_non_negative`, `stock_movements_quantity_positive`,
  `users_email_lowercase`, `memberships_invited_email_lowercase`).
  **No hay drift**: un segundo `migrate dev` dice *"Already in sync"* y
  `migrate diff --from-config-datasource --to-schema --script` devuelve *"This is an empty
  migration."* sin `DROP CONSTRAINT` ni `DROP EXTENSION` — Prisma ignora los CHECK y la extensión, así
  que las migraciones futuras **no** los van a borrar. Verificado por mí con psql: 7 tablas +
  `_prisma_migrations`, `pg_trgm 1.6`, 4 CHECK, 11 FK, `applied=true`.
  **Privilegios**: `anon`, `authenticated` y `service_role` en **false** para SELECT en las 7 tablas.
  Nota de Prisma 7: el flag `--shadow-database-url` ya no existe; para `migrate diff
  --from-migrations` hay que declarar `datasource.shadowDatabaseUrl` en `prisma.config.ts`.
  Commit `35eccee`. Superficies: `apps/api/prisma/migrations/**`.
- [x] **T5 — Adaptador Prisma de Company.** ✅ `PrismaCompanyRepository` cableado en `main.ts`; los
  tests siguen inyectando el in-memory (el smoke test no se tocó). El import del cliente generado es
  **type-only** a propósito: es ESM-first y Jest corre en CommonJS con `@swc/jest`, así que un import de
  runtime rompería la suite; la dependencia se reduce al delegate `company` (`Pick<PrismaClient,
  "company">`), así que el puerto sigue sin saber nada de Prisma. Las filas se mapean siempre a la
  entidad `Company` y el id que genera el dominio se escribe explícito para que el default de la base no
  lo pise. Test propio con un doble a mano (RED → GREEN) y **prueba end-to-end real**: alta, listado y
  borrado de una empresa contra Supabase, con `public.companies` en 0 filas antes y después. Commit de T5
  registrado en el commit siguiente.
  Superficies: `apps/api/src/infrastructure/database/prisma-company-repository.ts`, `apps/api/src/main.ts`.
- [x] **T6 — Documentación.** ✅ `apps/api/.env.example` (URL pooled vs directa, con el porqué de cada
  una), `docs/stack.md` §3.1 (hecho de seguridad medido), §3.2 (CHECKs y minúsculas a mano en la
  migración), §3.3 (Prisma 7: `prisma.config.ts`, `prisma-client` con `output`, comandos `db:*`,
  `migrate reset` prohibido), §5.3 (driver adapter sobre la URL pooled) y §6.2 (`pg_trgm` y la major 17,
  más la limpieza de `bcrypt`/`jsonwebtoken`/`multer` confirmada); `docs/Project.md` (entidad
  `Category`, `StockMovement` inmutable, `Product.category_id`); `docs/plan-de-trabajo.md` (decisiones #3
  y #4 resueltas, MI-38/MI-51 con sus commits); `README.md`.
  **Defecto encontrado y corregido en el camino**: el `README` documentaba `bun run test` y `bun run
  test:e2e` en la raíz, y **ninguno de los dos existía** — `bun run test` caía a `/usr/bin/test`. Se
  agregó el alias `test` → `turbo run test` (la tarea ya existía en `turbo.json`) y el de e2e quedó
  documentado con el comando que sí funciona (`cd apps/web && bun run test:e2e`). También se corrigieron
  los conteos de tests del README (137 → **144**: 33 api + 111 web) y se sacó la fila
  "sin tests en `apps/api` más allá del smoke", que MI-41 ya había dejado obsoleta.
  Superficies: `apps/api/.env.example`, `docs/stack.md`, `docs/Project.md`, `docs/plan-de-trabajo.md`,
  `README.md`, `package.json` (alias de test).
- [x] **T7 — Verificación y cierre.** ✅ Verificación **independiente** con `gentle-ai-verify` (no los
  reportes de implementación) y cierre en Jira.

  **Verificado**: los 4 `CHECK` probados con inserts rechazados dentro de transacciones revertidas; 11 FK
  con `delete_rule = RESTRICT`; `anon`/`authenticated`/`service_role` en **false para SELECT, INSERT,
  UPDATE, DELETE y TRUNCATE en las 7 tablas (21/21)**; `uuid` con default en la base; `timestamptz` en
  las 16 columnas; `users` sin `password_hash`; `companies` sin `owner_user_id`; end-to-end real contra
  el pooler con el id del dominio preservado (`ID_MATCHES true`); `prisma generate` sin `.env` OK (clon
  limpio pasa `tsc`); `grep` confirma que `domain/` y `application/` no importan Prisma; 33 tests de api
  + 111 de web en verde; `biome check` limpio.

  **Falso hasta corregirlo, y corregido**: el cierre original decía "check-types verde y build verde" de
  la **raíz**, y eso **no era cierto**. `bun run check-types` y `bun run build` fallan por `apps/web`: su
  `tsconfig` incluye `cypress/**` y el `expect` global resuelve a la `Assertion` de chai, así que `tsc`
  no reconoce los matchers de Jest (`error TS2339: Property 'toBe' does not exist on type 'Assertion'`,
  reproducido por mí). Es un **defecto pre-existente de MI-41** que además bloquea MI-36, y queda fuera
  del alcance de MI-38: el layer de datos no está afectado.

  **Jira**: MI-38 → `Done` (comentario `10042`) y MI-51 → `Done` (comentario `10043`), ambos con los
  criterios verificados uno por uno.
  Superficies: ninguna (verificación y cierre).

## Verificación

- Comandos: `prisma validate` · `prisma generate` · `prisma migrate status` · `bun run check-types` ·
  `bun test` · `bunx biome check .` · `bun run build`.
- Base: `psql "$DIRECT_URL"` listando tablas, `pg_extension` y los `CHECK` de `information_schema`.
- End-to-end: levantar la API y hacer `POST /companies` + `GET /companies` contra Supabase, después
  borrar la fila creada por la prueba.
- Riesgo abierto a verificar: si `env("DIRECT_URL")` hace fallar `prisma generate` sin `.env`
  (por ejemplo en un clon nuevo), la contingencia es resolver la URL con `process.env` en
  `prisma.config.ts` para que sólo los comandos de migración fallen. Hay que reportar lo observado.

## Follow-ups de la revisión nativa (informacionales, no bloqueantes)

La lente `review-reliability` aprobó el slice `2076ee6..HEAD`. Los cinco hallazgos son
`informational`: ninguno abre corrección, ninguno reabre la revisión y **no se re-verifica este
candidato por ellos**. El envelope trae id, lente, ubicación, severidad y disposición, pero **no el
texto del hallazgo**; lo que sigue es la ubicación exacta más mi lectura de esa línea.

| Id | Sev. | Ubicación | Qué hay en esa línea (lectura mía, a confirmar) |
|---|---|---|---|
| R3-001 | WARNING | `schema.prisma:86-90` | `@@unique([userId, companyId])` + los dos índices de `memberships`. Con `user_id IS NULL` el unique no aplica, así que **dos invitaciones para el mismo email y la misma empresa son posibles** y el match por email de §5.8 podría devolver más de una fila. |
| R3-002 | WARNING | `prisma-client.ts:19` | `connectionString ?? resolveDatabaseUrl()`: la validación (incluido el rechazo de vacío) sólo corre en el camino por defecto; `""` explícito la esquiva, y no se valida el esquema `postgresql://` como sí hace `env.ts`. |
| R3-003 | WARNING | `package.json:17` | `"postinstall": "prisma generate"` con `prisma` en devDependencies: en una instalación de sólo producción el script falla. Es el mismo riesgo que el worker había marcado. |
| R3-004 | SUGGESTION | `prisma.config.ts:24` | `url: process.env.DIRECT_URL` sin validar: si falta, las migraciones fallan con un error opaco en vez de decir que falta la variable. |
| R3-005 | SUGGESTION | `database-url.test.ts:1-36` | El archivo de test completo (36 líneas, 4 casos). |

Criterio para tratarlos: son trabajo posterior, no motivo para re-correr la revisión. Los que tocan
el modelo (R3-001) pertenecen a MI-44/MI-45; los de configuración (R3-002 a R3-004) se resuelven
cuando T7 cierre, o en la tarea de `.env.example` de la raíz (MI-37).

## Bitácora

- 2026-10-06 — Documento creado. Decisiones 1–6 tomadas por el usuario. Evidencia de entorno medida.
- 2026-10-06 — T1–T3 hechas y commiteadas (`050c13f` deps + config + schema, `cb85237` cliente Prisma).
  Dos defectos propios corregidos tras la revisión: el schema había quedado **sin relations**, es decir
  sin ninguna `FOREIGN KEY` (el doc listaba campos escalares y el worker lo siguió literal), y los
  timestamps eran `timestamp(3)` sin zona cuando §3.2 pide `timestamptz`. Ahora: 7 modelos, 11 FK con
  `ON DELETE RESTRICT`, 16 columnas `timestamptz(3)`, verificado con `prisma validate` y con un
  `prisma migrate diff --from-empty --to-schema` (preview SQL sin tocar la base).
- 2026-10-06 — **Hallazgo de seguridad** (ver memoria `inventory-manager/setup/supabase-privileges`):
  Supabase otorga CRUD completo a `anon`/`authenticated` por defecto en `public`, pero **sólo** para
  tablas creadas por `postgres`/`supabase_admin`. Las que crea el rol `prisma` **no reciben grants**
  (probado con una tabla temporal en una transacción revertida). Como decidimos no usar RLS (§3.1),
  esto es load-bearing: **cada tabla creada a mano por el editor SQL sí queda expuesta**. Va como check
  explícito en T7 y merece una línea en §3.1.
- 2026-10-06 — T4 bloqueada por la tabla sobrante `public.users`; el usuario optó por borrarla él.
- 2026-10-06 — **Revisión nativa (RDD), dos pasadas sobre el slice de Prisma.** El primer intento,
  sobre el alcance que el controlador derivó del punto de rama (`6d5c5d3..HEAD`, 46 archivos, incluida
  toda la migración a Jest/Cypress de MI-41), falló con **`lens_context_budget_exceeded`**: el candidato
  no entra en el presupuesto de contexto de las lentes y no se creó ninguna autoridad. La continuación
  que indica el propio nativo es **encadenar porciones más chicas**, así que se reencuadró a este slice
  (`2076ee6..HEAD`, 10 archivos) y ahí sí cerró: `review-reliability`, `medium`, `approved`, autoridad
  quemada (`gentle-ai.review-acknowledged/v1`). El controlador normaliza el `base-ref` al **tree** del
  commit base (`e87e72d685…` = tree de `2076ee6`, `b965481e…` = tree de `HEAD`), así que el rango
  revisado es exactamente el que se pidió.
- 2026-10-06 — **Segunda pasada** (el commit `d1f3a75` movió el árbol, el controlador volvió a ofrecer el
  rango de rama muerto y hubo que reencuadrar otra vez al slice): linaje `review-6ebec87cbc865089`,
  `review-reliability`, `medium`, `approved`, autoridad quemada. Los cinco hallazgos son los mismos de la
  primera pasada, con `R3-004` apuntando a `database-url.ts:27`.
  **Aprendizaje de proceso**: el `base-ref` derivado **no avanza** tras una aprobación, así que cada
  commit nuevo vuelve a ofrecer la rama entera y hay que reencuadrar con `baseRef` explícito. Por eso las
  actualizaciones de este doc van plegadas en commits de código y no sueltas.
- 2026-10-06 — **T4 aplicada.** El usuario corrió `DROP TABLE public.users;` y la migración
  `20261006223356_init` pasó sin drift. Dos verificaciones propias: (a) el estado de la base por `psql`;
  (b) el invariante de seguridad — los tres roles de la Data API sin privilegios en las 7 tablas, que es
  lo que hace que no usar RLS sea seguro (ver `inventory-manager/setup/supabase-privileges`).
- 2026-10-06 — **T5 y T6 hechas.** T5: `PrismaCompanyRepository` (import type-only del cliente generado
  para no romper Jest en CommonJS, dependencia reducida al delegate `company`, filas mapeadas a la
  entidad) cableado en el composition root, con test propio RED → GREEN y prueba real contra Supabase
  (alta, listado y borrado; `public.companies` en 0 antes y después). T6: documentación alineada y dos
  defectos de veracidad corregidos (los comandos `bun run test`/`test:e2e` de la raíz no existían; los
  conteos del README estaban viejos).
- 2026-10-06 — **T7: verificación independiente y cierre.** El verificador encontró que el cierre
  original de T7 era **falso** en un punto: `bun run check-types` y `bun run build` de la raíz **no**
  están verdes, fallan por `apps/web` (el `tsconfig` incluye `cypress/**` y el `expect` global resuelve a
  la `Assertion` de chai → `TS2339: Property 'toBe' does not exist on type 'Assertion'`). Es un defecto
  **pre-existente de MI-41** que bloquea MI-36; se reprodujo a mano y se documentó como fuera de alcance.
  Todo el resto del layer de datos quedó verificado: CHECKs que rechazan inserts de verdad, 21/21
  privilegios de la Data API en false, end-to-end con el id preservado, `generate` sin `.env`.
  Jira: MI-38 y MI-51 en `Done` (comentarios `10042` y `10043`).
- 2026-10-06 — **Revisión nativa (RDD) sobre este mismo doc**: el cambio sin commitear de este archivo
  fue el candidato (`sha256:2816e9ba…`), `review.start` lo cerró directo — `risk_tier: low`,
  `lenses_required: false`, motivo `non_executable_only` — y el acknowledgement quemó la autoridad
  (`authority: burned`, `gentle-ai.review-acknowledged/v1`). Sin lentes, sin consentimiento, sin
  envelope: un cambio sólo de documentación no justifica el ciclo de cuatro lentes.
