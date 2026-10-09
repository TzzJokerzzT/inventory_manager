# MI-36 — CI en GitHub Actions

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-36 (`To Do` → al cerrar)

## Objetivo

Crear el workflow de integración continua en `.github/workflows/`. Hoy **no existe `.github/`** en el
repo, así que esto es todo nuevo.

**Criterio de MI-36 (Jira, textual)**: en cada push/PR correr `bun install`, `bunx biome check .`,
`bun run check-types`, los tests y el build. **Ya no está bloqueada**: dependía de MI-35 (Git), que
está `Done` desde el 2026-10-06.

## Qué se corre y por qué

| Paso | Comando | Por qué |
|---|---|---|
| Instalación | `bun install --frozen-lockfile` | `--frozen-lockfile` es lo que hace determinista el CI: si el lockfile no coincide con los `package.json`, el job **falla** en vez de resolver versiones nuevas |
| Lint + formato | `bunx biome ci .` | Es el modo de Biome para CI: no escribe, sólo verifica. `biome check .` escribiría si algo está desalineado |
| Tipos | `bun run check-types` | `turbo run check-types`: los dos workspaces |
| Tests | `bun run test` | `turbo run test`: 43 en `apps/api` + 111 en `apps/web` |
| Build | `bun run build` | `turbo run build` |
| Migraciones | `prisma migrate deploy` contra un **Postgres efímero** | Es la única forma de que el CI detecte una migración rota: aplica la cadena **desde cero** en una base vacía |

**La base efímera no es Supabase.** Va como *service container* de GitHub Actions (`postgres:17`,
que ya trae `pg_trgm` de contrib), con health check, y `DIRECT_URL`/`DATABASE_URL` apuntando ahí.
Nunca se tocan las credenciales del proyecto real: los secretos de Supabase no se configuran en el
repositorio y el workflow no los necesita.

## Qué NO entra

- **Cypress (E2E)**: `docs/stack.md` §4.2 lo admite "sólo en la rama principal para acotar costo", pero
  además **nunca se corrió**: el spec de `apps/web` se configuró en MI-41 y quedó sin verificar (la
  verificación independiente lo marcó como no verificado por necesitar el dev server). Meter un job
  que no sabemos si pasa deja el CI rojo desde el día uno. Queda como follow-up explícito.
- **Despliegue**: MI-36 es CI, no CD. Nada de Vercel.
- **Secretos de Supabase/Auth0**: el CI no los necesita y no se configuran.

## Validación local: qué se puede y qué no (medido antes de escribir nada)

| Se puede validar localmente | No se puede |
|---|---|
| `bun install --frozen-lockfile`, `biome ci`, `check-types`, `test`, `build` | El `migrate deploy` contra base **vacía**: **Docker está instalado pero el daemon está apagado**, no hay servidor Postgres local (sólo el cliente `psql`) y no hay `actionlint` |
| La sintaxis del YAML (`pyyaml`) | La semántica real de Actions (versiones de las actions, service container, health check) — eso lo prueba GitHub en el primer push |

Consecuencia honesta: el paso de migraciones queda **validado por el propio CI en el primer push**, no
localmente. Si el usuario levanta el daemon de Docker (`sudo systemctl start docker`), se puede validar
localmente con un contenedor `postgres:17` descartable; es la única forma de probarlo antes de pushear.

## Decisiones de diseño

- **Un workflow** (`ci.yml`) con **dos jobs**: `verify` (lint, tipos, tests, build) y `migrations`
  (base efímera). Separados para que un fallo de migración se lea como tal y no se confunda con un
  test roto.
- **Disparadores**: `pull_request` y `push` a las ramas largas (`production`, `development`). No en
  `push` a cualquier rama de feature: para eso está el PR.
- **`permissions: contents: read`** — el workflow no necesita escribir nada en el repo.
- **`concurrency`** con cancelación: un push nuevo cancela el run viejo de la misma rama.
- **`oven-sh/setup-bun`** con la versión que declara `devEngines.packageManager` (`1.4.2`) para que el
  CI use la misma que el desarrollo; **`actions/setup-node`** con Node 24, que es lo que pide
  `engines`.
- Acciones con versión mayor fija (`@v4`/`@v5`), no `@master`.

## Tareas

- [x] **T1 — Job `verify`.** ✅ Los cinco pasos del criterio, con `pull_request` + `push` a
  `production`/`development`, `permissions: contents: read` y `concurrency` que cancela el run anterior
  de la misma rama.
- [x] **T2 — Job `migrations`.** ✅ `postgres:17` como service container con health check,
  `DATABASE_URL`/`DIRECT_URL` apuntando al contenedor y `bun run db:deploy` + `db:status` con
  `working-directory: apps/api`. Sin secretos del repositorio.
- [x] **T3 — Validación local.** ✅ `bun install --frozen-lockfile` no-op (lockfile en sincronía),
  `biome ci` read-only y verde, `check-types` verde, **154 tests** verdes, `build` verde y el YAML
  parsea. **No validado, declarado**: el job de migraciones (no hay daemon de Docker ni Postgres
  local) y la semántica propia de GitHub.
- [x] **T4 — Documentación y Jira.** ✅ `docs/stack.md` §4.2 reescrita con lo que quedó (dos jobs, el
  porqué del job de migraciones, el pendiente de Cypress), sección de CI en el `README.md`, y la
  descripción de MI-36 reescrita en Jira con el límite declarado.
- [x] **T5 — Verificación y cierre.** ✅ MI-36 en `Done` (comentario `10045`).

## Correcciones al brief (para que quede el registro)

- **Las versiones de las actions de mi brief estaban viejas.** Yo pedí `@v4`/`@v5`; el worker verificó
  contra la API de GitHub y se desvió, y **tenía razón**: hoy `actions/checkout` va por **v7.0.1**,
  `actions/setup-node` por **v7.0.0** y `oven-sh/setup-bun` **sólo tiene hasta v2** — o sea que el
  `@v4` que yo había pedido para setup-bun **no habría resuelto** y el workflow fallaba al arrancar.
  Lo verifiqué yo también contra la API antes de aceptarlo.
- **`biome ci` sale 0 con un warning**: encontró un import sin usar en
  `apps/web/src/features/register/components/register-form.tsx` (el WIP de registro del usuario, sin
  commitear). Es warning, no error, así que el CI queda verde. Si se quisiera tratar los warnings como
  errores habría que agregar `--error-on-warnings`, y eso hoy pondría el CI en rojo por ese archivo.

## Riesgo declarado

El CI **no se puede probar de verdad sin pushear**: hasta el primer run en GitHub, lo único verificado
es que los comandos pasan localmente y que el YAML parsea. Eso hay que decirlo en el cierre, no
esconderlo detrás de un "listo".

## Bitácora

- 2026-10-06 — Documento creado. Criterio de MI-36 leído de Jira. Medido: no existe `.github/`, no hay
  daemon de Docker, no hay Postgres local, `actionlint` no está disponible. Decidido: base efímera como
  service container (nunca Supabase), Cypress fuera con follow-up explícito.
- 2026-10-06 — **T1–T5 hechas.** Workflow creado (commit `7303324`), validado localmente lo validable,
  documentado y cerrado en Jira (comentario `10045`). Dos correcciones al brief: las versiones de las
  actions (ver arriba) y el warning de Biome sobre el WIP del usuario. **El workflow no corre hasta que
  la rama se pushee**: hasta entonces no hay run que mirar, y eso hay que decirlo en el cierre.
