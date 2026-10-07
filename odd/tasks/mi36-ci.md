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

- [ ] **T1 — Job `verify`.** `.github/workflows/ci.yml` con disparadores, permisos, concurrencia y los
  cinco pasos del criterio. Superficies: `.github/workflows/ci.yml`.
- [ ] **T2 — Job `migrations`.** Service container `postgres:17` con health check, variables de
  entorno apuntando al contenedor, `prisma migrate deploy` y `prisma migrate status`. Superficies:
  `.github/workflows/ci.yml`.
- [ ] **T3 — Validación local.** Correr **cada comando** que ejecuta el workflow y verificar la sintaxis
  del YAML. Declarar explícitamente lo que no se pudo validar y por qué.
- [ ] **T4 — Documentación y Jira.** `README.md` (sección de CI: qué corre, dónde, y el límite de
  Cypress), `docs/stack.md` §4.2 alineada con lo que realmente quedó, y MI-36 en Jira (descripción con
  el estado real + cierre).
- [ ] **T5 — Verificación y cierre.** Gates verdes, verificación independiente del YAML si aporta, y
  cierre en Jira.

## Riesgo declarado

El CI **no se puede probar de verdad sin pushear**: hasta el primer run en GitHub, lo único verificado
es que los comandos pasan localmente y que el YAML parsea. Eso hay que decirlo en el cierre, no
esconderlo detrás de un "listo".

## Bitácora

- 2026-10-06 — Documento creado. Criterio de MI-36 leído de Jira. Medido: no existe `.github/`, no hay
  daemon de Docker, no hay Postgres local, `actionlint` no está disponible. Decidido: base efímera como
  service container (nunca Supabase), Cypress fuera con follow-up explícito.
