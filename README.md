# Inventory Manager

Sistema de gestión de inventarios **multi-empresa**. Permite a un usuario administrar varias
empresas, y dentro de cada una gestionar productos, clientes, entradas y salidas de stock, con
alertas automáticas de stock bajo.

Monorepo gestionado con **Turborepo**, con dos aplicaciones **independientes**: una SPA para el
frontend y una API REST para el backend. No hay código compartido entre ellas.

> **Documentación relacionada**
> - [`docs/Project.md`](docs/Project.md) — requerimientos funcionales y no funcionales, entidades, roadmap y fases
> - [`docs/stack.md`](docs/stack.md) — stack tecnológico decidido, con observaciones y pendientes
> - [`design/`](design/) — design system y mockups (OpenPencil, `.fig` + previews `.png`)

---

## Estado del proyecto

⚠️ **El proyecto está en construcción.** Las dos aplicaciones ya existen y el tooling está
funcionando. **El flujo de autenticación completo ya está implementado** (registro, login mediado
por la API con el gate de email verificado, refresh, logout, bootstrap de sesión y manejo del 401),
**las empresas ya funcionan** (alta con la membership de dueño en una sola transacción, listado
filtrado por membership y endpoint de contexto con sus reglas de autorización) y **la firma de
subidas de media por empresa ya está cableada**, junto con el shell de la aplicación, la vista del
dashboard y el design system. Quedan pendientes **los módulos de negocio** (productos, movimientos,
clientes y notificaciones de stock bajo) y **la gestión de miembros** de una empresa.
El repositorio y el stack de tests ya están en pie.

| Componente | Estado |
|------------|--------|
| Monorepo con Turborepo + Bun | ✅ |
| `apps/web` (Next.js 16 + React 19) | ✅ Tailwind CSS v4 + shadcn/ui |
| `apps/api` (Express 5 + TypeScript) | ✅ Clean Architecture, 9 operaciones en `openapi.yaml` |
| **Biome** (lint + formato) | ✅ único tool del repo — `bun run lint` (`biome check .`) en verde |
| **Tokens del design system** | ✅ paleta en `tokens.ts` + variables CSS con modo claro y oscuro |
| **Modo oscuro** | ✅ `next-themes` + `ThemeProvider` + toggle |
| Typecheck | ✅ `apps/web` y `apps/api` limpios (`tsc --noEmit`) |
| **Autenticación** | ✅ registro, login (gate de email verificado), refresh, logout y bootstrap de sesión contra Auth0 |
| **Empresas** | ✅ alta con membership `OWNER` en una transacción, listado por membership y `GET /companies/{id}/context` |
| **Media (Cloudinary)** | ✅ firma de subida directa por empresa (`POST /companies/{id}/media/signature`) |
| **Prisma + Supabase** | ✅ `schema.prisma`, migración `20261006223356_init` aplicada y repositorios Prisma cableados |
| **Frontend** | ✅ shell de la app (`AppShell`), vista del dashboard y páginas de login/registro/sin-empresas |
| **Contrato OpenAPI** | ✅ `openapi.yaml` servido en `/docs` + tipos del frontend generados desde él |
| **Repositorio Git** | ✅ repo propio en `TzzJokerzzT/inventory_manager`, con las ramas `production`, `development` y `feat/login-register-backend-frontend` |
| **Tests** | ✅ **Jest** como único runner en las dos apps, más Cypress E2E; `bun run test` corre ambas suites y reporta el conteo |
| **Husky + commitlint** | ✅ `pre-commit` (typecheck + Biome + tests), `commit-msg` (Conventional Commits) |
| **CI** | ✅ `.github/workflows/ci.yml` — `verify` (install con lockfile congelado, `biome ci`, tipos, tests, build) + `migrations` (`prisma migrate deploy` sobre un Postgres efímero) |

Lo que queda está desglosado en el roadmap de [`docs/Project.md`](docs/Project.md) y detallado en
[Pendientes](#pendientes).

---

## Funcionalidades

### Qué funciona hoy

**Autenticación (mediada por la API, proveedor Auth0).** Registro (la respuesta es idéntica si la
cuenta se creó o si el alta fue rechazada, para no revelar si el email ya existía), login con el
gate de **email verificado**, refresh del token de acceso desde la cookie `httpOnly`, logout (limpia
la cookie) y restauración de sesión al arrancar. En el frontend, el cliente HTTP maneja el 401 con
un refresh de un solo vuelo y reintenta la petición una vez. **La recuperación de contraseña todavía
no existe.**

**Empresas.** Alta de empresa con la membership de dueño (`OWNER`) creada en la misma transacción;
listado de las empresas del usuario (solo memberships `ACTIVE`); endpoint de contexto que resuelve
la empresa y el rol del usuario; y switch de empresa en la barra superior. Productos, clientes y
movimientos están solo en el esquema de datos —no hay endpoints ni pantallas todavía—, así que el
aislamiento por empresa aplica hoy a lo que está construido (empresas y media).

**Subida de media por empresa.** El backend firma los parámetros de subida directa a Cloudinary
(`POST /companies/{id}/media/signature`): la carpeta, los formatos y el tamaño los decide el servidor,
nunca el cliente.

**Shell y dashboard.** El shell de la aplicación (barra lateral con navegación, switch de empresa,
logout y modo oscuro) y una vista de dashboard con KPIs, alertas y tabla de stock crítico **con
datos de muestra**: el nombre de la empresa activa es real (viene de `GET /companies`), pero los
indicadores y la tabla son mock declarado.

**Design system.** Paleta de tokens (modo claro y oscuro), componentes base (`Button`, `Card`,
`Spinner`, `Toast`) y componentes del design system (`Alert`, `DataTable`, `KpiCard`, `StockBadge`,
`FormField`, `Checkbox`), con una página de referencia en `/design-system`.

### Planificado

**Dashboard con datos reales.** Reemplazar los datos de muestra por los indicadores reales
(MI-6/MI-9).

**Gestión de productos.** Alta, edición y baja lógica con nombre, descripción, precio, foto y
**código SKU único dentro de cada empresa** (MI-7; vistas MI-21 y MI-25).

**Entradas y salidas de inventario.** Registro de entradas y salidas con actualización automática
del stock, historial por producto y motivo; **una salida nunca puede superar el stock disponible**
(MI-8; vista MI-26).

**Gestión de clientes.** Alta, edición y baja con historial de compras alimentado por los
movimientos de salida (MI-11; vista MI-24).

**Notificaciones de stock bajo.** Umbral mínimo por producto, alerta visual en el dashboard y
listado de reposición (MI-12).

**Gestión de miembros.** Invitar, asignar roles y dar de baja miembros de una empresa (MI-45/MI-46/
MI-47); la matriz de autorización ya está modelada en el backend.

**Recuperación de contraseña.** Flujo de reset (MI-16); hoy no existe.

---

## Stack tecnológico

Detalle completo y observaciones en **[`docs/stack.md`](docs/stack.md)**.

| Capa | Decisión |
|------|----------|
| **Monorepo** | Turborepo + **Bun** como gestor de paquetes |
| **Frontend** | SPA con **React + Next.js + TypeScript** · arquitectura **Vertical Slice** |
| **Backend** | API REST con **Node + Express + TypeScript** · arquitectura **Clean Architecture** |
| **Base de datos** | **PostgreSQL** en **Supabase** · ORM **Prisma** |
| **Autenticación** | **Auth0** (OIDC) — el backend **valida** el JWT, no lo emite |
| **Storage de imágenes** | **Cloudinary**, con subida directa desde el cliente |
| **Hosting** | **Vercel** |
| **CI/CD** | **GitHub Actions** |
| **Contenedores** | No se usan |

**Frontend:** Axios · Zustand · TanStack Query · Valibot · shadcn/ui ·
Framer Motion · Recharts · Tailwind CSS · lucide-react · Biome · Jest · React Testing Library ·
Cypress · Husky

**Backend:** express · cors · helmet · cookie-parser · morgan · express-rate-limit · prisma ·
express-oauth2-jwt-bearer · express-validator · Valibot · cloudinary · swagger + yamljs ·
dotenv · http-status-codes · Biome · Jest · supertest

**Base de datos:** PostgreSQL como motor (última estable soportada por Supabase); Supabase aporta el
Postgres gestionado y el **pooler (Supavisor)** obligatorio para serverless. **No** se usan las
migraciones de Supabase (se usa Prisma), ni Storage (va a Cloudinary), ni Auth/GoTrue (el proveedor
es Auth0), ni Row Level Security: el **aislamiento por empresa vive en la capa de aplicación**.

---

## Arquitectura

El monorepo contiene **dos aplicaciones independientes**. No comparten código: cada una tiene sus
propias dependencias, su configuración y su despliegue. Turborepo se usa para orquestar tareas
(dev, build, test, typecheck) y cachear resultados, no para compartir módulos.

### Frontend — Vertical Slice (`apps/web`)

Cada funcionalidad es una **rebanada vertical** que agrupa todo lo suyo: componentes, hooks, estado,
servicios y tests. No se organiza por tipo de archivo.

```
apps/web/
├── app/                          # rutas de Next.js (App Router)
│   ├── login/                    # pantalla de login
│   ├── registro/                 # pantalla de registro
│   ├── sin-empresas/             # estado "sin empresas"
│   ├── dashboard/                # dashboard dentro del shell
│   └── design-system/            # página de referencia del design system
├── components/
│   ├── ui/                       # componentes base (button, card, spinner, toast)
│   └── design-system/            # componentes del design system + tokens
├── lib/                          # cliente HTTP, schemas Valibot, utilidades
├── src/
│   └── features/                 # ← una carpeta por funcionalidad
│       ├── auth/                 # login, registro, logout y sesión (refresh/bootstrap)
│       ├── company/              # empresas, switch y contexto activo
│       ├── dashboard/            # vista del dashboard (datos de muestra)
│       └── shell/                # el shell de la aplicación
└── public/
```

Reglas:

- **Zustand** solo para estado de UI (modales, filtros abiertos, **empresa activa**).
- **TanStack Query** para todo dato que venga del servidor. Nunca se duplica en Zustand.
- La UI consume los **tokens del design system** vía Tailwind, con soporte de **modo claro y oscuro**.

### Backend — Clean Architecture (`apps/api`)

Las dependencias apuntan **hacia adentro**: el dominio no conoce Express, ni Prisma, ni Auth0.

```
apps/api/
├── src/
│   ├── domain/                   # ← el centro, sin dependencias externas
│   │   ├── entities/             # Company, Membership, User
│   │   ├── errors/               # errores de dominio (EmailNotVerified, …)
│   │   ├── policies/             # matriz de autorización
│   │   └── repositories/         # interfaces (puertos), no implementaciones
│   ├── application/              # casos de uso
│   │   ├── ports/                # IdentityProvider, MediaUploadSigner
│   │   └── use-cases/            # create-company, list-companies, login, register, refresh
│   ├── infrastructure/           # implementaciones de los puertos
│   │   ├── database/             # Prisma: repositorios y mapeos
│   │   ├── auth0/                # validación del JWT de Auth0 (JWKS)
│   │   └── storage/              # Cloudinary (firma de subida)
│   └── interfaces/               # adaptadores de entrada
│       └── http/
│           ├── controllers/
│           ├── routes/
│           ├── middlewares/      # auth, validación, rate limit, errores
│           └── validators/       # esquemas Valibot
├── prisma/
│   ├── schema.prisma             # fuente de verdad del esquema
│   └── migrations/
└── tests/                        # unitarios (Jest) e integración (supertest)
```

Regla de oro: **una capa hacia adentro**. `interfaces` e `infrastructure` dependen de `application`
y `domain`; nunca al revés. Si el dominio importa `express` o `@prisma/client`, la arquitectura se
rompió.

### Contrato entre frontend y backend

Al ser aplicaciones **independientes y sin código compartido**, los esquemas Valibot **no se
comparten**: cada app valida lo suyo. El contrato es la **especificación OpenAPI de la API**
(`apps/api/openapi.yaml`), la fuente de verdad de los 9 endpoints: métodos, seguridad y códigos de
error. El backend la sirve en `/docs` (Swagger UI) y en `/docs/openapi.json`, y el frontend
**genera sus tipos desde esa especificación** (`cd apps/web && bun run openapi:generate`, que escribe
`lib/api/openapi.d.ts`) y los consume en `lib/api/schemas.ts` con Valibot.

El artefacto generado está **commiteado** y un test de drift (`lib/api/openapi-drift.test.ts`)
detecta si la spec cambió sin regenerar los tipos. Regenerar requiere **red o una caché de `bunx`
caliente** (baja `openapi-typescript` y su propio TypeScript 5.x); ningún build ni el CI lo necesita.

### Endpoints de la API

Las 9 operaciones registradas en el contrato. «Token» = cabecera `Authorization: Bearer <JWT>`;
el `429` es el rate limit (el global aplica a todas las rutas, y login/register/refresh suman uno
propio más estricto). Las rutas de empresa exigen además una membership `ACTIVE` (ver la sección
siguiente).

| Operación | Token | Errores que importan | Qué hace |
|-----------|-------|----------------------|----------|
| `GET /health` | no | 429 | Sonda de vida |
| `POST /auth/login` | no | 400, 401, 403 (`email_not_verified`), 429, 500, 503 | Intercambia email/contraseña por un access token; el refresh viaja en cookie `httpOnly` |
| `POST /auth/register` | no | 400, 429, 500, 503 | Crea la cuenta; la respuesta no revela si el email ya existía |
| `POST /auth/refresh` | no (cookie `httpOnly`) | 401, 429, 500, 503 | Renueva el par de tokens desde la cookie |
| `POST /auth/logout` | no | 429, 500 | Limpia la cookie del refresh (sin revocación en el proveedor) |
| `POST /companies` | sí | 400, 401, 403 (`user_not_provisioned`), 429, 500 | Crea una empresa con la membership `OWNER` en una transacción |
| `GET /companies` | sí | 401, 403 (`user_not_provisioned`), 429, 500 | Lista las empresas del usuario |
| `GET /companies/{companyId}/context` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden`), 429, 500 | Resuelve la empresa y el rol del usuario |
| `POST /companies/{companyId}/media/signature` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden`), 429, 500 | Firma los parámetros de subida directa |

### Aislamiento por empresa (el punto crítico)

No se usa **Row Level Security** de Supabase, así que **el aislamiento entre empresas depende por
completo del código de la aplicación**. Hoy hay dos piezas que lo materializan:

- **En el repositorio**, el listado filtra por memberships `ACTIVE` (`findAllForUser`) y el alta
  crea la empresa y la membership del dueño en **una sola transacción** (`createOwnedBy`).
- **En el HTTP**, `requireCompanyContext` valida en cada request que el usuario tiene una membership
  `ACTIVE` en la empresa del path (`/companies/:companyId/*`) y resuelve su rol. Un no-miembro y una
  empresa inexistente responden el mismo 403 (`company_access_forbidden`) para que los ids no se
  puedan enumerar.

El límite honesto: esto cubre lo que está construido (empresas, contexto y firma de media). Los
recursos por empresa que todavía no existen (productos, movimientos, clientes) **deberán colgarse del
mismo sub-router protegido**, no inventar un camino nuevo a la membership. Sigue siendo el mayor
riesgo de seguridad del proyecto: cada consulta nueva debe filtrar por `company_id` y traer su test.

---

## Instalación

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| **Node.js** | `>=24` (declarado en `engines`) |
| **Bun** | `1.4.2` (declarado en `devEngines`) |

### Pasos

```sh
# 1. Clonar
git clone git@github.com:TzzJokerzzT/inventory_manager.git
cd inventory-manager

# 2. Instalar dependencias (Bun resuelve los workspaces del monorepo)
bun install

# 3. Variables de entorno (ver Configuración)
cp apps/api/.env.example apps/api/.env        # luego completá los valores
cp apps/web/.env.example apps/web/.env.local  # NEXT_PUBLIC_API_URL
```

> El proyecto usa **Bun** como gestor de paquetes (`bun.lock` y `devEngines` en el `package.json`
> raíz). Si usás otro gestor, los workspaces no se resuelven igual.
>
> `bun install` además corre el hook de `prepare`, que instala **Husky** (los git hooks de
> `.husky/`).
>
> La API **no arranca sin sus variables**: `main.ts` falla rápido si faltan las de Auth0 o
> Cloudinary, y el cliente de Prisma exige `DATABASE_URL`.

---

## Uso

### Desarrollo

```sh
bun run dev
```

Levanta las aplicaciones con la TUI de Turborepo (requiere las variables de entorno ya en su lugar):

| App | URL |
|-----|-----|
| `apps/web` | http://localhost:3000 |
| `apps/api` | http://localhost:3001 (`GET /health`) · `/docs` (Swagger UI) |

Para levantar una sola app:

```sh
bun run dev --filter=web
```

### Scripts disponibles

Todos desde la raíz del monorepo:

| Comando | Qué hace |
|---------|----------|
| `bun run dev` | Desarrollo de las apps (Turborepo TUI) |
| `bun run build` | Build de producción de las apps |
| `bun run lint` | Lint de todo el repo con Biome (`biome check .`) |
| `bun run check-types` | Verificación de tipos en todos los workspaces (Turborepo) |
| `bun run format` | Formatea todo el repo con Biome (`biome format --write .`) |
| `bun run format:check` | Verifica el formato sin escribir (para el CI) |
| `bun run test` | Jest en todos los workspaces, vía Turborepo |
| `cd apps/web && bun run openapi:generate` | Regenera `lib/api/openapi.d.ts` desde `apps/api/openapi.yaml` — requiere red o una caché de `bunx` caliente |
| `cd apps/web && bun run test:e2e` | Cypress en `apps/web` — **requiere el dev server levantado** (`bun run dev`) |

### Build de producción

```sh
bun run build
```

Turborepo cachea el resultado por hash de entradas: si nada cambió, no recompila.

### Integración continua

`.github/workflows/ci.yml` corre en cada `pull_request` y en cada `push` a `production` y
`development`, con dos jobs:

| Job | Qué corre |
|-----|-----------|
| `verify` | `bun install --frozen-lockfile` · `biome ci` · `check-types` · `test` · `build` |
| `migrations` | `prisma migrate deploy` y `migrate status` contra un **Postgres efímero** (`postgres:17` como *service container*) |

El job de migraciones es el único que aplica la cadena **desde cero sobre una base vacía**: es la única
forma de que el CI detecte una migración rota. El contenedor es descartable y **nunca** se toca el
proyecto real de Supabase; el workflow no usa secretos del repositorio, así que funciona igual en un
fork.

**Pendiente declarado:** Cypress (E2E) no está en el workflow. El spec nunca se corrió (necesita el dev
server) y un job que falla desde el primer push no aporta; se suma cuando esté verificado.

---

## Distribución de carpetas

### Actual

```
inventory-manager/
├── apps/
│   ├── web/                      # Next.js — puerto 3000
│   │   ├── app/                  # App Router (layout, page, globals.css)
│   │   ├── components/ui/        # shadcn/ui (button)
│   │   ├── lib/                  # cn y utilidades
│   │   ├── public/
│   │   ├── components.json       # config de shadcn/ui
│   │   ├── postcss.config.mjs    # Tailwind v4
│   │   ├── tsconfig.json         # independiente (no extiende ningún paquete del monorepo)
│   │   └── package.json
│   └── api/                      # Express 5 + TypeScript — Clean Architecture
│       ├── src/domain/           # entidades, errores y puertos (sin dependencias externas)
│       ├── src/application/      # casos de uso
│       ├── src/infrastructure/   # adaptadores (Prisma, Auth0 y Cloudinary)
│       ├── src/interfaces/http/  # app.ts, controladores, rutas, middlewares, validadores
│       ├── src/config/           # env
│       ├── src/main.ts           # composition root
│       ├── tests/                # unitarios (Jest) + integración (supertest)
│       └── .env.example
├── design/                       # design system y mockups (.fig + previews .png)
├── docs/                         # Project.md (requerimientos) y stack.md (stack)
├── odd/tasks/                    # seguimiento de tareas del workflow ODD
├── biome.json                    # config de Biome
├── turbo.json
├── package.json
├── bun.lock
└── README.md
```

### Objetivo

```
inventory-manager/
├── apps/
│   ├── web/                      # SPA (Next.js) — Vertical Slice
│   └── api/                      # API REST (Express) — Clean Architecture ✅ creada
├── .github/workflows/            # CI: lint, tipos, tests, build y migraciones
├── design/
├── docs/
├── odd/tasks/
├── biome.json
├── turbo.json
└── package.json
```

No hay carpeta `packages/`: las aplicaciones son independientes y no comparten código.

---

## Configuración

### `turbo.json`

Define las tareas del monorepo y su grafo de dependencias.

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**"]
    },
    "check-types": { "dependsOn": ["^check-types"] },
    "test": { "outputs": [] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

Puntos a tener en cuenta:

- `build` declara `.env*` como **input**, así que cambiar una variable de entorno invalida la caché.
- `dev` no se cachea y es persistente (queda corriendo).
- `test` corre Jest en los dos workspaces.
- `lint` ya **no** es una tarea de Turborepo: el script `lint` de la raíz es `biome check .` y corre
  directo.

### Puertos

| App | Puerto | Dónde se define |
|-----|--------|-----------------|
| `web` | 3000 | `apps/web/package.json` → `next dev --port 3000` |
| `api` | 3001 | `apps/api/.env.example` (`PORT`, por defecto 3001) |

### Variables de entorno

El `.env.example` de la raíz es la **vista del monorepo**: documenta, en un solo lugar, cada variable
que el código lee. Las apps traen su ejemplo junto a sí (`apps/api/.env.example` y
`apps/web/.env.example`). La API **falla rápido al arrancar** si faltan las de Auth0 o Cloudinary, y
el cliente de Prisma exige `DATABASE_URL`; en `production`, `env.ts` además valida el formato de cada
una.

| Variable | Para qué |
|----------|----------|
| `PORT` | Puerto de la API (opcional; por defecto 3001) |
| `WEB_ORIGIN` | Origen del navegador autorizado a llamar a la API **con credenciales** (la cookie del refresh). Obligatoria en producción; en desarrollo cae a `http://localhost:3000` |
| `DATABASE_URL` | Conexión a Postgres **vía pooler de Supabase** (puerto 6543, `?pgbouncer=true`) — la usa el cliente de runtime |
| `DIRECT_URL` | Conexión **directa** (puerto 5432) — la usan el CLI y las migraciones de Prisma |
| `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` | Validación del JWT en la API |
| `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` / `AUTH0_CONNECTION` | Intercambio de credenciales con Auth0 (ROPG). El `client_secret` es un secreto: sólo en el `.env` local y en las variables del deploy |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Firma de subida directa (el `api_secret` es un secreto) |
| `NEXT_PUBLIC_API_URL` | URL base de la API desde el frontend (se inyecta en el bundle; no admite secretos) |

### Estándares de código

El proyecto usa **Biome** para lint **y** formato: `biome.json` en la raíz, con las directivas de
Tailwind habilitadas y `apps/web/public` excluido del lint de a11y. Scripts: `lint` →
`biome check .`, `format` → `biome format --write .` y `format:check` para el CI. **ESLint y
Prettier ya no están**: se removieron en el setup (MI-30).

### Husky y commitlint (git hooks)

Instalados por el script `prepare` de la raíz (corre en cada `bun install`). Los hooks viven en
`.husky/`:

| Hook | Qué hace |
|------|----------|
| `commit-msg` | `bunx commitlint --edit` — valida el mensaje contra **Conventional Commits** (`@commitlint/config-conventional`) |
| `pre-commit` | `bun run check-types` + `bunx biome check --staged --no-errors-on-unmatched` + `bun run test` |

La convención de mensajes del repo es **Conventional Commits** (`feat:`, `fix:`, `chore:`, …), y es
la que `commit-msg` hace cumplir.

---

## Pendientes

El setup de la Fase 1 está cerrado: Git, CI, Prisma + Supabase, Auth0, Cloudinary (firma), tests,
Husky, el `.env.example` de la raíz y el contrato OpenAPI ya están en el repo. Lo que queda es **el
producto en sí**, no la infraestructura.

### Gestión de miembros (multi-usuario)

El modelo de acceso ya está en `schema.prisma` y la matriz de autorización en
`apps/api/src/domain/policies/authorization.ts`, pero los endpoints todavía no existen:

- [ ] **Asignar un miembro con rol** — **MI-45** (ADMIN/OWNER asignan; OWNER asigna ADMIN/OWNER).
- [ ] **Aceptar una asignación** — **MI-46** (incluye decidir qué hacer con más de una invitación
      pendiente al mismo email).
- [ ] **Cambiar el rol de un miembro (promover/rebajar)** — **MI-47**.
- [ ] **Invariante del último OWNER** — **MI-49**: una empresa nunca puede quedar sin OWNER (la regla
      ya está en `can()`, falta el endpoint que la use).

### Core de inventario (Fase 2 y 3)

- [ ] **Dashboard con datos reales** — MI-6/MI-9: reemplazar los datos de muestra de `DashboardView`.
- [ ] **CRUD de productos** — MI-7 (vistas MI-21 y MI-25).
- [ ] **Entradas y salidas de stock** — MI-8 (vista MI-26).
- [ ] **CRUD de clientes** — MI-11 (vista MI-24).
- [ ] **Notificaciones de stock bajo** — MI-12.

### Polish (Fase 4)

- [ ] **Recuperación de contraseña** — MI-16.
- [ ] **Gráficos** — MI-14.
- [ ] **Filtros y búsqueda** — MI-15.
- [ ] **Notificaciones por email** — MI-13.

### Decisiones abiertas

- [ ] **Store compartido del rate limit**: el contador en memoria no limita globalmente en serverless
      (el backend va a Vercel). Recomendado **Vercel KV** o **Upstash Redis**.
- [ ] **Renombrar `Mode 1` a `Light`** en el archivo de diseño (**MI-17**).
- [ ] **Alinear el `.fig`** con el modelo de memberships (todavía dibuja un dueño único) y guardarlo:
      el documento vivo de OpenPencil tiene más tokens que el `.fig` en disco.

El detalle histórico del camino crítico sigue en [`docs/plan-de-trabajo.md`](./docs/plan-de-trabajo.md),
pero se generó antes del cierre de autenticación/empresas y hoy está parcialmente desactualizado (da
por pendientes MI-37, MI-42, MI-43 y MI-54, que ya están en el repo).

### Modelo de datos

El esquema ya existe en [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) y está
aplicado con la migración `20261006223356_init`. Las reglas de negocio que materializa están en
[`docs/stack.md` § 3.2](docs/stack.md#32-esquema-implicancias-del-dominio) — entre ellas:
`UNIQUE (company_id, sku)`, `numeric(12,2)` para dinero, `CHECK (stock >= 0)`, `uuid` como PK,
`auth0_sub UNIQUE` en usuarios y actualización de stock en la misma transacción que el movimiento.

---

## Referencias

- [Turborepo](https://turborepo.dev/docs) — orquestación del monorepo
- [Next.js](https://nextjs.org/docs) — framework del frontend
- [Tailwind CSS](https://tailwindcss.com/docs) — estilos
- [shadcn/ui](https://ui.shadcn.com/docs) — componentes de UI
- [Supabase](https://supabase.com/docs) — plataforma de base de datos
- [Prisma](https://www.prisma.io/docs) — ORM
- [Auth0](https://auth0.com/docs) — proveedor de identidad
- [Biome](https://biomejs.dev/) — lint y formato
