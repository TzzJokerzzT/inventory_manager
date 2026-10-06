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
- [ ] **T4 — Primera migración aplicada.** `migrate dev --create-only`, después editar el SQL para
  agregar al inicio `CREATE EXTENSION IF NOT EXISTS pg_trgm;` y al final los `CHECK`
  (`stock_quantity >= 0`, `quantity > 0`), y aplicar. Evidencia: `migrate status` OK y `psql` con
  las tablas, el índice unique y los checks.
  Superficies: `apps/api/prisma/migrations/**`.
- [ ] **T5 — Adaptador Prisma de Company.** `PrismaCompanyRepository implements CompanyRepository`
  (recibe el `PrismaClient` por constructor, devuelve entidades de dominio) y cableado en `main.ts`.
  Los tests siguen inyectando el adaptador in-memory. Evidencia: alta y listado reales contra Supabase.
  Superficies: `apps/api/src/infrastructure/database/prisma-company-repository.ts`, `apps/api/src/main.ts`.
- [ ] **T6 — Documentación.** `apps/api/.env.example` descomentado con nota del pooler;
  `docs/stack.md` §3.3 y §5.3 con Prisma 7 (`prisma.config.ts` + driver adapter) y la decisión de
  `pg_trgm`; `docs/Project.md` entidades (`Category`, `StockMovement` sin `updated_at`);
  `docs/plan-de-trabajo.md` (decisiones #3 y #4 resueltas, MI-38/MI-51 hechas).
- [ ] **T7 — Verificación y cierre.** `biome check .`, `check-types`, `bun test`, `build` verde,
  `migrate status` limpio, end-to-end contra Supabase, commits por work-unit y cierre de MI-38 y MI-51
  en Jira.

## Verificación

- Comandos: `prisma validate` · `prisma generate` · `prisma migrate status` · `bun run check-types` ·
  `bun test` · `bunx biome check .` · `bun run build`.
- Base: `psql "$DIRECT_URL"` listando tablas, `pg_extension` y los `CHECK` de `information_schema`.
- End-to-end: levantar la API y hacer `POST /companies` + `GET /companies` contra Supabase, después
  borrar la fila creada por la prueba.
- Riesgo abierto a verificar: si `env("DIRECT_URL")` hace fallar `prisma generate` sin `.env`
  (por ejemplo en un clon nuevo), la contingencia es resolver la URL con `process.env` en
  `prisma.config.ts` para que sólo los comandos de migración fallen. Hay que reportar lo observado.

## Bitácora

- 2026-10-06 — Documento creado. Decisiones 1–6 tomadas por el usuario. Evidencia de entorno medida.
