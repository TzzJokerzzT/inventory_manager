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
funcionando. **La capa de datos (Prisma + Supabase) ya está configurada** (schema, migración
aplicada y adaptador); quedan pendientes **autenticación (Auth0) y almacenamiento (Cloudinary)**.
El repositorio y el stack de tests ya están en pie.

| Componente | Estado |
|------------|--------|
| Monorepo con Turborepo + Bun | ✅ |
| `apps/web` (Next.js 16 + React 19) | ✅ Tailwind CSS v4 + shadcn/ui |
| `apps/api` (Express 5 + TypeScript) | ✅ Clean Architecture, `GET /health` funcionando |
| **Biome** (lint + formato) | ✅ único tool del repo — `biome check .` en verde |
| **Tokens del design system** | ✅ los 38 (19 claros + 19 oscuros) aplicados al tema |
| **Modo oscuro** | ✅ `next-themes` + `ThemeProvider` + toggle |
| Typecheck | ✅ `apps/web` y `apps/api` limpios (`tsc --noEmit`) |
| **Prisma + Supabase** | ✅ `schema.prisma`, migración `20261006223356_init` aplicada y adaptador `PrismaCompanyRepository` cableado |
| **Auth0** | ❌ no configurado |
| **Cloudinary** | ❌ no configurado |
| **Repositorio Git** | ✅ repo propio en `TzzJokerzzT/inventory_manager`, con las ramas `production`, `development` y `feat/login-register-backend-frontend` |
| **Tests** | ✅ **Jest** como único runner: 144 tests (33 en `apps/api`, 111 en `apps/web`) + Cypress E2E; tarea `test` en `turbo.json` |
| **CI** | ❌ no configurado |

Las configuraciones pendientes están desglosadas como **subtareas de [MI-2](https://alexbuelvas92.atlassian.net/browse/MI-2)** — [Fase 1] Setup del
proyecto. Ver [Pendientes](#pendientes) para el detalle y el orden sugerido.

---

## Funcionalidades

### Autenticación
Registro, inicio y cierre de sesión, recuperación de contraseña y gestión de sesiones con JWT.
**Delegada a Auth0.**

### Dashboard de inventario
Número total de productos, valor del inventario, movimientos del día, gráficos de distribución de
stock por categoría, tabla de productos con stock crítico y filtrado por empresa.

### Gestión de productos
Alta, edición y baja lógica de productos con nombre, descripción, precio, foto y **código SKU**.
El SKU es **único dentro de cada empresa**, no global. Búsqueda y filtrado por nombre, SKU o
categoría, y carga de imagen optimizada.

### Entradas y salidas de inventario
Registro de entradas (compra, ajuste, devolución) y salidas (venta, ajuste, daño), con
actualización automática del stock, historial por producto y registro de usuario, fecha y motivo.
**Una salida nunca puede superar el stock disponible.**

### Gestión de clientes
Alta, edición y baja lógica de clientes, con historial de compras alimentado por los movimientos
de salida vinculados.

### Multi-empresa
Un usuario puede crear y administrar **una o varias empresas**. Productos, clientes y movimientos
están **aislados por empresa**, y hay un switch de contexto siempre visible en la barra superior.

### Notificaciones de stock bajo
Umbral mínimo configurable por producto, alerta visual en el dashboard, badge persistente en la
barra superior y listado de productos a reponer.

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

**Frontend:** Axios · @auth0/auth0-react · Zustand · TanStack Query · Valibot · shadcn/ui ·
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
(dev, build, lint, typecheck) y cachear resultados, no para compartir módulos.

### Frontend — Vertical Slice (`apps/web`)

Cada funcionalidad es una **rebanada vertical** que agrupa todo lo suyo: componentes, hooks, estado,
servicios y tests. No se organiza por tipo de archivo.

```
apps/web/
├── app/                          # rutas de Next.js (App Router)
│   ├── (auth)/                   # grupo: login, registro, recuperación
│   └── (dashboard)/              # grupo: dashboard, productos, movimientos, clientes
├── components/
│   └── ui/                       # componentes shadcn/ui
├── lib/                          # utilidades (cn, cliente HTTP, helpers)
├── src/
│   └── features/                 # ← una carpeta por funcionalidad
│       ├── products/
│       │   ├── components/       # UI propia de la feature
│       │   ├── hooks/            # lógica de la feature
│       │   ├── api/              # llamadas al backend (Axios + TanStack Query)
│       │   ├── stores/           # estado de UI (Zustand)
│       │   ├── schemas/          # validación con Valibot
│       │   └── __tests__/        # unitarios e integración (Jest + RTL)
│       ├── inventory-movements/
│       ├── customers/
│       ├── companies/            # incluye el switch de empresa
│       └── dashboard/
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
│   │   ├── entities/             # Product, Customer, StockMovement, Company
│   │   ├── value-objects/        # Sku, Money, StockLevel
│   │   └── repositories/         # interfaces (puertos), no implementaciones
│   ├── application/              # casos de uso
│   │   └── use-cases/            # CreateProduct, RegisterStockEntry, …
│   ├── infrastructure/           # implementaciones de los puertos
│   │   ├── database/             # Prisma: repositorios y mapeos
│   │   ├── auth/                 # validación del JWT de Auth0 (JWKS)
│   │   └── storage/              # Cloudinary (firma de subida)
│   └── interfaces/               # adaptadores de entrada
│       └── http/
│           ├── controllers/
│           ├── routes/
│           ├── middlewares/      # auth, validación, rate limit, errores
│           └── validators/       # esquemas Valibot
├── prisma/
│   ├── schema.prisma             # fuente de verdad del esquema
│   ├── migrations/
│   └── seed.ts
└── tests/                        # unitarios (Jest) e integración (supertest)
```

Regla de oro: **una capa hacia adentro**. `interfaces` e `infrastructure` dependen de `application`
y `domain`; nunca al revés. Si el dominio importa `express` o `@prisma/client`, la arquitectura se
rompió.

### Contrato entre frontend y backend

Al ser aplicaciones **independientes y sin código compartido**, los esquemas Valibot **no se
comparten**: cada app valida lo suyo. Para que las reglas no se dupliquen a mano, el contrato es la
**especificación OpenAPI de la API** (el backend ya incluye `swagger` + `yamljs` en su stack):
el frontend debería **generar sus tipos desde esa especificación**.

Esto reemplaza al paquete de validadores compartidos que se había planteado antes de decidir que las
apps fueran independientes. Ver [Pendientes](#pendientes).

### Aislamiento por empresa (el punto crítico)

No se usa **Row Level Security** de Supabase, así que **el aislamiento entre empresas depende por
completo del código de la aplicación**. Cada consulta del repositorio debe filtrar por `company_id`,
y debe existir un test que lo verifique. Es el mayor riesgo de seguridad del proyecto.

---

## Instalación

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| **Node.js** | `>=24` (declarado en `engines`) |
| **Bun** | `1.4.2` (gestor de paquetes del proyecto) |

### Pasos

```sh
# 1. Clonar
git clone <url-del-repositorio>
cd inventory-manager

# 2. Instalar dependencias (Bun resuelve los workspaces del monorepo)
bun install
```

> El proyecto usa **Bun** como gestor de paquetes (`bun.lock` y `devEngines` en el `package.json`
> raíz). Si usás otro gestor, los workspaces no se resuelven igual.

---

## Uso

### Desarrollo

```sh
bun run dev
```

Levanta las aplicaciones con la TUI de Turborepo:

| App | URL |
|-----|-----|
| `apps/web` | http://localhost:3000 |
| `apps/api` | http://localhost:3001 (`GET /health`) |

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
| `bun run lint` | Lint en todos los workspaces |
| `bun run check-types` | Verificación de tipos en todos los workspaces |
| `bun run format` | Formatea todo el repo con Biome (`biome format --write .`) |
| `bun run format:check` | Verifica el formato sin escribir (para el CI) |
| `bun run test` | Jest en todos los workspaces, vía Turborepo |
| `cd apps/web && bun run test:e2e` | Cypress en `apps/web` — **requiere el dev server levantado** (`bun run dev`). Todavía no hay alias en la raíz |

### Build de producción

```sh
bun run build
```

Turborepo cachea el resultado por hash de entradas: si nada cambió, no recompila.

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
│       ├── src/infrastructure/   # adaptadores (hoy: repositorio en memoria)
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
├── .github/workflows/            # CI: lint, tipos, tests, migraciones        ← a crear
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
    "lint": { "dependsOn": ["^lint"] },
    "check-types": { "dependsOn": ["^check-types"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

Puntos a tener en cuenta:

- `build` declara `.env*` como **input**, así que cambiar una variable de entorno invalida la caché.
- `dev` no se cachea y es persistente (queda corriendo).
- **La tarea `test`** ya está en `turbo.json` y corre Jest en los dos workspaces.

### Puertos

| App | Puerto | Dónde se define |
|-----|--------|-----------------|
| `web` | 3000 | `apps/web/package.json` → `next dev --port 3000` |
| `api` | 3001 | `apps/api/.env.example` (`PORT`, por defecto 3001) |

### Variables de entorno

**Parcialmente configuradas.** `apps/api/.env.example` ya existe y documenta `PORT`,
`DATABASE_URL` (URL pooled del pooler, puerto 6543, con `?pgbouncer=true`) y `DIRECT_URL` (URL
directa, puerto 5432, para migraciones), además de los placeholders de `AUTH0_*`. Falta el
`.env.example` de la raíz (**MI-37**), que conviene cerrar junto con Auth0 y Cloudinary.
Debe documentar al menos:

| Variable | Para qué |
|----------|----------|
| `DATABASE_URL` | Conexión a Postgres **vía pooler de Supabase** (puerto 6543, `?pgbouncer=true`) — la usa el cliente de runtime |
| `DIRECT_URL` | Conexión **directa** (session pooler, puerto 5432) — la usan el CLI y las migraciones de Prisma |
| `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` | Validación del JWT en la API |
| `NEXT_PUBLIC_AUTH0_DOMAIN` / `NEXT_PUBLIC_AUTH0_CLIENT_ID` | SDK de Auth0 en el frontend |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Firma de subida directa |
| `NEXT_PUBLIC_API_URL` | URL base de la API desde el frontend |

### Estándares de código

El proyecto usa **Biome** para lint **y** formato: `biome.json` en la raíz, con las directivas de
Tailwind habilitadas y `apps/web/public` excluido del lint de a11y. Scripts: `lint` →
`biome check .`, `format` → `biome format --write .` y `format:check` para el CI. **ESLint y
Prettier ya no están**: se removieron en el setup (MI-30).

### Husky (git hooks)

Planificado, no instalado (**MI-42**). El objetivo es correr lint, typecheck y los tests afectados en
cada commit, para que el CI no sea la primera red de seguridad. **Depende de tener repositorio Git
propio** (MI-35).

---

## Pendientes

### Bloqueantes

Cada uno tiene su subtarea bajo **[MI-2](https://alexbuelvas92.atlassian.net/browse/MI-2)** — [Fase 1] Setup del proyecto (backend + frontend).

- [x] **Configurar control de versiones (Git)** — **MI-35**. **Hecho**: repositorio propio en
      `TzzJokerzzT/inventory_manager`, con las ramas `production`, `development` y
      `feat/login-register-backend-frontend`. Desbloquea el CI y Husky.
- [ ] **Crear el workflow de CI** en `.github/workflows/` — **MI-36**. Depende de MI-35.
- [ ] **Crear el `.env.example` de la raíz** — **MI-37**. El de `apps/api` ya existe; falta el del
      monorepo y el del frontend.
- [x] **Configurar Prisma + Supabase** — **MI-38**: `schema.prisma`, migración
      `20261006223356_init` aplicada y conexión vía pooler con el adapter `@prisma/adapter-pg`.
      Cierra con la verificación de T7.
- [ ] **Configurar Auth0** — **MI-39**: tenant, aplicación SPA, API con *audience* y validación
      JWKS en la API. Hoy `express-oauth2-jwt-bearer` está declarado pero sin cablear.
- [ ] **Configurar Cloudinary** — **MI-40** para subida directa firmada desde el cliente.
- [ ] **Configurar los tests** — **MI-41** (Jest, React Testing Library, Supertest, Cypress) y
      agregar la tarea `test` a `turbo.json`. La API ya tiene un smoke test con el runner de Bun que
      sirve de base.
- [ ] **Instalar Husky (git hooks)** — **MI-42**. Depende de MI-35.
- [ ] **Definir el contrato entre frontend y backend** — **MI-43**. Al no haber código compartido,
      hay que decidir cómo se evita duplicar las reglas de validación: lo recomendado es **generar
      los tipos del frontend desde la especificación OpenAPI** que ya produce el backend con
      `swagger + yamljs`.

### Decisiones abiertas

- [ ] **Store compartido del rate limit** (**MI-38**). El backend va a Vercel, así que el contador en memoria no
      limita globalmente. Recomendado **Vercel KV** o **Upstash Redis**.
- [x] **UX de autenticación con Auth0** (**MI-39**): **resuelta** — formulario propio mediado por el backend
      (ROPG). Ver [`docs/stack.md` §5.4](./docs/stack.md). Efecto: las pantallas de Login/Registro del diseño
      se implementan tal cual, y el rate limiting del login pasa a ser **obligatorio**.
- [ ] **Cómo se testean los endpoints protegidos** con Supertest (**MI-39**): clave de prueba o stub del
      middleware de validación de Auth0.
- [x] **Extensión `pg_trgm`** para búsqueda difusa de productos y clientes: **sí** (**MI-38**),
      activada en la primera migración.
- [x] **Versión *major* de PostgreSQL**: **17** (el servidor aprovisionado reporta 17.6).
- [ ] **Renombrar el modo `Mode 1` a `Light`** en la colección de variables del archivo de diseño (**MI-17**).

**El mapa completo de lo pendiente** — con dependencias, bloqueantes y el camino crítico — está en
[`docs/plan-de-trabajo.md`](./docs/plan-de-trabajo.md). Incluye las 12 subtareas nuevas del modelo de
acceso multi-usuario (MI-44 a MI-51) y de los endpoints de autenticación (MI-52 a MI-55), y tres
inconsistencias detectadas que no estaban en ninguna tarea.

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
