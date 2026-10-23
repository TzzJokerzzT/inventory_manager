# Inventory Manager

Sistema de gestión de inventarios **multi-empresa**. Permite a un usuario administrar varias
empresas, y dentro de cada una gestionar productos, clientes, entradas y salidas de stock, con
alertas automáticas de stock bajo.

Monorepo gestionado con **Turborepo**, con dos aplicaciones **independientes**: una SPA para el
frontend y una API REST para el backend. No hay código compartido entre ellas.

> **Documentación relacionada**
>
> - [`docs/Project.md`](docs/Project.md) — requerimientos funcionales y no funcionales, entidades, roadmap y fases
> - [`docs/stack.md`](docs/stack.md) — stack tecnológico decidido, con observaciones y pendientes
> - [`design/`](design/) — design system y mockups (OpenPencil, `.fig` + previews `.png`)

---

## Estado del proyecto

⚠️ **El proyecto está en construcción.** Las dos aplicaciones ya existen y el tooling está
funcionando. **El flujo de autenticación completo ya está implementado** (registro, login mediado
por la API con el gate de email verificado, refresh, logout, bootstrap de sesión y manejo del 401),
**las empresas ya funcionan** (alta con la membership de dueño en una sola transacción, listado
filtrado por membership y endpoint de contexto con sus reglas de autorización), **la gestión de
miembros está implementada** (invitación, listado, cambio de rol, revocación, salida, aceptación de
invitaciones y notificaciones), **la firma de subidas de media por empresa ya está cableada** y
**el catálogo de productos es el primer módulo de negocio terminado** (CRUD por empresa con SKU único,
búsqueda, baja lógica reversible con papelera y restauración, y foto subida con firma), **los
movimientos de stock también están terminados** (entradas y salidas con actualización atómica del
stock, historial filtrable e
auditoría inmutable de usuario, fecha y motivo) y **el padrón de clientes está cerrado** (CRUD por
empresa con baja lógica y búsqueda por nombre, email o teléfono), junto con el shell de la
aplicación, **la vista del dashboard, que ya es enteramente real** —cuatro KPIs, alertas, tabla de
stock crítico y los gráficos, todos derivados de la empresa activa (MI-6 y MI-14)— y el design
system. Los clientes se gestionan **por empresa y cualquier miembro activo** los crea, edita y da de
baja, y **la vinculación de clientes a las salidas de stock (MI-10 / CLI-04) también está hecha**:
una salida puede asociarse a un cliente —opcional, nunca una entrada— y el historial resuelve el
nombre del lado del servidor, incluso después de que el cliente se dé de baja. Quedan pendientes
**las notificaciones de stock bajo y la recuperación de contraseña** (el resumen de compras por
cliente, con sus columnas, sigue sin construirse).
Cada movimiento y el cambio de stock ocurren en **una sola transacción** —una salida nunca puede
superar el stock disponible: la perdedora de dos salidas concurrentes responde `409
insufficient_stock` sin registrar nada— y los movimientos son **inmutables**, porque son la traza de
auditoría del inventario.
El repositorio y el stack de tests ya están en pie.

| Componente | Estado |
| ------------ | -------- |
| Monorepo con Turborepo + Bun | ✅ |
| `apps/web` (Next.js 16 + React 19) | ✅ Tailwind CSS v4 + shadcn/ui |
| `apps/api` (Express 5 + TypeScript) | ✅ Clean Architecture, 34 operaciones en `openapi.yaml` |
| **Biome** (lint + formato) | ✅ único tool del repo — `bun run lint` (`biome check .`) en verde |
| **Tokens del design system** | ✅ paleta en `tokens.ts` + variables CSS con modo claro y oscuro |
| **Modo oscuro** | ✅ `next-themes` + `ThemeProvider` + toggle |
| Typecheck | ✅ `apps/web` y `apps/api` limpios (`tsc --noEmit`) |
| **Autenticación** | ✅ registro, login (gate de email verificado), refresh, logout y bootstrap de sesión contra Auth0 |
| **Empresas** | ✅ alta con membership `OWNER` en una transacción, listado por membership y `GET /companies/{id}/context` |
| **Miembros** | ✅ invitación, listado, cambio de rol, revocación y salida por empresa, más invitaciones y notificaciones en `/me` |
| **Productos** | ✅ CRUD por empresa, SKU único (normalizado a mayúsculas), búsqueda por nombre/SKU, baja lógica reversible (papelera + restaurar) y foto firmada a Cloudinary |
| **Movimientos** | ✅ entradas y salidas con stock atómico (una transacción con guard `stockQuantity >= quantity`), historial por producto, auditoría de usuario/fecha/motivo y cliente opcional en las salidas (MI-10) |
| **Clientes** | ✅ CRUD por empresa con baja lógica y búsqueda por nombre, email o teléfono; escribe cualquier membership `ACTIVE`, las salidas pueden asociarse a un cliente (MI-10) y el detalle de un cliente lista sus salidas |
| **Media (Cloudinary)** | ✅ firma de subida directa por empresa (`POST /companies/{id}/media/signature`) |
| **Prisma + Supabase** | ✅ `schema.prisma`, migración `20261006223356_init` aplicada y repositorios Prisma cableados |
| **Frontend** | ✅ shell de la app (`AppShell`), dashboard con datos reales (cuatro KPIs, alertas, tabla de stock crítico y los gráficos de MI-14, todo derivado de la empresa activa), páginas de login/registro/sin-empresas, el catálogo de productos (lista, alta, edición, papelera y restauración), los movimientos (formulario e historial) y el padrón de clientes (lista, búsqueda, formulario y detalle de las salidas del cliente) |
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
la empresa y el rol del usuario; y switch de empresa en la barra superior. El aislamiento por empresa
cubre todo lo que está construido (empresas, media, miembros, productos, movimientos y clientes).

**Miembros de la empresa.** Invitación por email, listado de miembros, cambio de rol, revocación y
salida de la empresa, más el listado y la aceptación de invitaciones y las notificaciones del
usuario (`/me/invitations`, `/me/notifications`). La matriz de autorización decide quién asigna cada
rol —un `OWNER` puede asignar `ADMIN` u `OWNER`, un `ADMIN` asigna `MEMBER`—, nadie cambia su propio
rol y el último `OWNER` activo no puede salir de la empresa.

**Productos.** Catálogo por empresa en `/dashboard/products`: listado con búsqueda por nombre **o**
SKU (subcadena, sin distinguir mayúsculas), alta, edición parcial y baja lógica (`204`). El SKU se
normaliza a mayúsculas y es **único por empresa incluidas las filas dadas de baja**: un producto
eliminado sigue reservando su SKU, así que recrearlo responde `409 sku_already_exists`.

La baja es **reversible** y esa es la forma de reutilizar el producto. El interruptor **Papelera** de
`/dashboard/products` cambia el listado por el de productos dados de baja
(`GET /companies/{id}/products?deleted=true`, que devuelve **solo** las bajas, con la misma búsqueda y
el mismo orden; sin el parámetro la lista sigue siendo el catálogo activo) y en esa vista cada fila
ofrece **Restaurar**, sin confirmación porque es una acción segura, mientras crear, editar y eliminar
quedan ocultos. Restaurar (`POST /companies/{id}/products/{productId}/restore`) limpia `deletedAt` y
devuelve el producto **activo con su mismo SKU y su historial de movimientos intacto**. Restaurar uno
que no está dado de baja responde `409 product_not_deleted` —la papelera es un estado, no un flag—,
uno de otra empresa o inexistente responde el mismo `404 product_not_found` y el permiso es el de la
baja (`manage_products`, ADMIN u OWNER). **La purga física (borrado definitivo) no está
implementada**: es una feature aparte, OWNER-only y bloqueada cuando el producto tiene movimientos,
porque `stock_movements.product_id` es `ON DELETE RESTRICT` y el ledger no puede perder filas.
El precio viaja como **string decimal** (`"1500.00"`) porque la columna es `Decimal(12,2)` y un
número JSON perdería precisión. La foto se sube **directo a Cloudinary** con la firma de
`POST /companies/{id}/media/signature` y sólo se guarda el `secure_url`. Escribir (crear, editar o
dar de baja) exige `manage_products`, que la matriz resuelve como `ADMIN` u `OWNER`; un `MEMBER` lee
el catálogo y recibe `403 insufficient_role` si intenta escribir. Crear y editar confirman con un
**toast** y vuelven al listado. `stockQuantity` es del servidor
(sólo lo mueven las entradas y salidas de MI-8) y `lowStockThreshold` sigue en el default de la base;
`categoryId` no se expone porque todavía no existe la feature de categorías, así que el filtro por
categoría de PROD-04 **no** está implementado.

**Movimientos de stock.** Entradas (`IN`) y salidas (`OUT`) en `/dashboard/movements`: formulario con
selector de producto real, cantidad y motivo opcional, más una tabla con tipo, producto, cantidad,
motivo, usuario y fecha. `POST /companies/{id}/movements` responde `201` con el movimiento y el
`stockQuantity` del producto **después** del movimiento, y `GET /companies/{id}/movements` lista el
historial de la empresa más reciente primero, con los filtros `productId`, `customerId` y `type`, y
`limit` de `1` a `200` (default `50`). `customerId` es un **filtro de lectura** combinable con los
otros: un cliente de otra empresa no devuelve filas en vez de responder `404`, y el `companyId`
sigue siendo obligatorio en la consulta. Ese filtro es el que usa el detalle de un cliente (ver
**Clientes**) para mostrar sus salidas, así que la página de movimientos **queda como está**: el
detalle es una vista adicional y de solo lectura. El movimiento y el cambio de stock van en **una
sola transacción**: una entrada suma, una salida resta y, si el movimiento no se puede registrar, el
stock no cambia. **Una salida nunca puede superar el stock disponible**, porque la resta se hace con
un update guardado (`stockQuantity >= quantity`): dos salidas concurrentes no pueden dejar stock
negativo y la perdedora responde `409 insufficient_stock` con el stock disponible, sin registrar
nada. El formulario confirma cada registro con un **toast** que muestra el stock resultante devuelto
por la transacción —no el de la caché— y cada rechazo (`409 insufficient_stock`, `404
customer_not_found`, `400 customer_requires_exit`) llega al mismo toast con el mensaje de la API: ya no
hay alerts inline. Los movimientos son
**inmutables** —no hay endpoints de edición ni de borrado— porque son la traza de auditoría del stock
(MOV-05); `userId` y `createdAt` los pone el servidor y `reason` es opcional (≤300 caracteres).
Cualquier membership `ACTIVE` registra y todos los roles leen el historial. **Una salida puede
asociarse a un cliente** (MI-10 / CLI-04): el alta acepta un `customerId` **opcional y nullable** y
cada movimiento del contrato lo expone resuelto (`customerId` más `customer: { id, name } | null`).
Sólo vale para `OUT` —una entrada con cliente responde `400 customer_requires_exit`, porque una
compra a proveedor no es una venta del cliente— y el cliente debe existir, estar activo y pertenecer
a la empresa: un id ajeno, inexistente o dado de baja responde el mismo `404 customer_not_found`. Las
dos validaciones corren **antes** de tocar el stock, así que un movimiento rechazado no registra
fila ni mueve el stock. La asociación es opcional y **una venta sin cliente identificado sigue siendo
válida**: se guarda con `customerId: null`. El historial resuelve el cliente en el servidor y **sigue
mostrando su nombre después de la baja lógica**, porque la lectura por lote incluye las filas dadas
de baja: el movimiento es la traza de auditoría. En la UI, el formulario de **salida** suma el
selector opcional con la opción "Sin cliente" y la tabla suma la columna Cliente (nombre, o "—"),
mientras el formulario de entrada no lo muestra. No hizo falta migración: `customer_id` existe desde
la migración inicial. Las fotos de producto no cambian y `stockQuantity` sigue sin ser escribible
desde los endpoints de productos.

**Clientes.** Padrón por empresa en `/dashboard/clients`: listado con búsqueda, alta y edición en un
formulario en la misma página, y baja con confirmación en dos pasos. `GET
/companies/{id}/customers?search=` devuelve los clientes **activos** ordenados por nombre y luego por
id, y `search` compara por subcadena y sin distinguir mayúsculas contra **nombre, email o teléfono**
(el tope del contrato son 100 caracteres). Los campos son `name` (obligatorio, 1..120 tras trim) y
tres contactos opcionales: `email` (se guarda en minúsculas, con el formato validado y ≤254),
`phone` (≤40, sólo dígitos y `+ - ( ) . espacio`) y `address` (≤300); un valor vacío o sólo espacios
se guarda como `null`. `PATCH` es **parcial** —un campo ausente no cambia y un `null` limpia el
contacto— y `DELETE` responde `204` con **baja lógica**: la fila queda, pero el cliente desaparece
del listado y de las lecturas, y un segundo `DELETE` responde `404 customer_not_found`. **No hay
unicidad de email** porque el esquema no tiene índice único, así que dos clientes de la misma empresa
pueden compartirlo. **Cualquier membership `ACTIVE`** crea, edita y da de baja, y todos los roles
leen; un `customerId` de otra empresa y uno dado de baja responden el mismo `404`. Las salidas pueden
asociarse a un cliente (MI-10, ver **Movimientos de stock**). Cada fila suma además la acción
**Detalle**, que abre un panel **en la misma página** con los datos de contacto del cliente y la tabla
de **sus salidas** (`type=OUT`): fecha, producto, SKU, cantidad, motivo y usuario, más el conteo de
salidas y el total de unidades **de las salidas listadas**. El panel aclara que son las más recientes
porque el endpoint pagina el historial: informa lo que recibió, nunca un total histórico. Es de solo
lectura, no tiene ruta propia ni endpoint nuevo —reutiliza `GET /companies/{id}/movements` con
`customerId` (ver **Movimientos de stock**)— y **no muestra montos de dinero**, porque un movimiento
no guarda precio. **El resumen de compras por cliente sigue sin construirse**: el padrón no muestra
columnas "Compras"/"Total" (decisión L4 de `odd/tasks/customer-links.md`), así que la tabla
principal sigue mostrando sólo los datos de contacto.

**Subida de media por empresa.** El backend firma los parámetros de subida directa a Cloudinary
(`POST /companies/{id}/media/signature`): la carpeta, los formatos y el tamaño los decide el servidor,
nunca el cliente.

**Shell y dashboard.** El shell de la aplicación (barra lateral con navegación, switch de empresa,
logout y modo oscuro) y la vista de dashboard de la empresa activa, **toda con datos reales**: los
cuatro KPIs, las alertas y la tabla de stock crítico (MI-6) más los tres gráficos (MI-14). Los datos
salen de dos lecturas de la empresa activa —`GET /companies/{id}/products`, que ya devuelve el
catálogo completo sin paginar, y el reporte de evolución de los últimos 30 días—, así que **no hay
endpoint de métricas** ni datos de muestra: el aviso "Datos de muestra" se eliminó porque ya no era
cierto. Los cuatro KPIs son:

1. **Total de productos** — el tamaño del catálogo activo de la empresa (DASH-01).
2. **Valor del inventario** — `precio × stock` de todo el catálogo, sumado en **centavos enteros** con
   el mismo helper del gráfico de valor, así que la tarjeta y el gráfico muestran el mismo total
   (DASH-04).
3. **Productos con stock crítico** — los productos donde `stockQuantity <= lowStockThreshold`. Hoy el
   umbral es siempre 0, así que son los **agotados**; cuando MI-12 permita editarlo, la misma regla
   cubre el stock bajo sin tocar el dashboard.
4. **Unidades movidas hoy (UTC)** — `entries + exits` del último punto del reporte de 30 días. Es UTC
   y así se rotula, porque el reporte agrega por **día UTC**: el número no es "hoy" en el calendario
   del navegador.

La **tabla de stock crítico** usa ese mismo predicado —el KPI, las alertas y la tabla no pueden
discrepar— y ordena por unidades ascendente y luego por nombre, con las columnas Producto, SKU,
Categoría, Precio, Unidades y Estado (`StockBadge`); la Categoría es **—** mientras no exista la
feature de categorías. Las **alertas** salen de los mismos números: una de peligro si hay agotados,
una de advertencia si hay críticos que todavía tienen unidades y una informativa cuando no hay
ninguna. Mientras las lecturas no responden los KPIs muestran **—** (nunca un cero que nadie
calculó), un fallo de lectura se muestra como una sola alerta y sin productos críticos la tabla lo
dice. Los tres gráficos son:

- **Distribución del stock** por **estado** (agotados contra con stock), no por categoría: DASH-02
  pedía categorías, pero esa feature todavía no existe (el `categoryId` de todos los productos es
  nulo), así que un gráfico por categoría mostraría una única porción "Sin categoría". Cuando las
  categorías existan, reemplazan esta división; no se suma un cuarto gráfico.
- **Valor del inventario**: `precio × stock` de cada producto, sumado en **centavos enteros** (el
  precio es un string decimal y sumar floats mostraría un total que nadie puede reconciliar), con el
  total de la empresa y las barras de los **8 productos de mayor valor**.
- **Evolución de entradas y salidas**: barras apiladas por **día UTC** de los últimos 30 días, desde
  `GET /companies/{id}/reports/movements?days=` (ventana de `1` a `90` días, `days` por defecto `30`,
  días sin movimientos rellenados con cero y del más viejo al más nuevo).

Los gráficos usan **Recharts** (ya estaba en el stack) y tienen estado de carga, de error y de vacío.

**Design system.** Paleta de tokens (modo claro y oscuro), componentes base (`Button`, `Card`,
`Spinner`, `Toast`) y componentes del design system (`Alert`, `DataTable`, `KpiCard`, `Modal`,
`StockBadge`, `FormField`, `Checkbox`), con una página de referencia en `/design-system`.

### Planificado

**Notificaciones de stock bajo.** Umbral mínimo por producto, alerta visual en el dashboard y
listado de reposición (MI-12).

**Recuperación de contraseña.** Flujo de reset (MI-16); hoy no existe.

---

## Stack tecnológico

Detalle completo y observaciones en **[`docs/stack.md`](docs/stack.md)**.

| Capa | Decisión |
| ------ | ---------- |
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
│       ├── member/               # invitaciones, roster de miembros y salida de la empresa
│       ├── product/              # catálogo de productos (lista, búsqueda, formulario, foto, papelera)
│       ├── movement/             # entradas y salidas de stock (formulario e historial)
│       ├── client/               # padrón de clientes (lista, búsqueda, formulario, baja y detalle)
│       ├── dashboard/            # vista del dashboard (KPIs, alertas, tabla y gráficos reales)
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
│   │   ├── entities/             # Company, Membership, Product, StockMovement, User
│   │   ├── errors/               # errores de dominio (EmailNotVerified, …)
│   │   ├── policies/             # matriz de autorización
│   │   └── repositories/         # interfaces (puertos), no implementaciones
│   ├── application/              # casos de uso
│   │   ├── ports/                # IdentityProvider, MediaUploadSigner
│   │   └── use-cases/            # create-company, list-companies, login, register, refresh,
│   │                             # productos (create/list/get/update/delete), movimientos
│   │                             # (register-stock-movement, list-stock-movements) y el reporte
│   │                             # del dashboard (get-movement-trend)
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
(`apps/api/openapi.yaml`), la fuente de verdad de los endpoints (34 operaciones): métodos, seguridad
y códigos de error. El backend la sirve en `/docs` (Swagger UI) y en `/docs/openapi.json`, y el frontend
**genera sus tipos desde esa especificación** (`cd apps/web && bun run openapi:generate`, que escribe
`lib/api/openapi.d.ts`) y los consume en `lib/api/schemas.ts` con Valibot.

El artefacto generado está **commiteado** y un test de drift (`lib/api/openapi-drift.test.ts`)
detecta si la spec cambió sin regenerar los tipos. Regenerar requiere **red o una caché de `bunx`
caliente** (baja `openapi-typescript` y su propio TypeScript 5.x); ningún build ni el CI lo necesita.

### Endpoints de la API

Las operaciones de autenticación, empresas, media, miembros, invitaciones, notificaciones, productos,
movimientos, clientes y reportes del contrato (`apps/api/openapi.yaml`, 34 operaciones en total),
servidas en `/docs`.
«Token» = cabecera `Authorization: Bearer <JWT>`; el `429` es el rate limit (el global aplica a todas
las rutas, y login/register/refresh suman uno propio más estricto). Las rutas de empresa exigen además
una membership `ACTIVE` (ver la sección siguiente).

| Operación | Token | Errores que importan | Qué hace |
| ----------- | ------- | ---------------------- | ---------- |
| `GET /health` | no | 429 | Sonda de vida |
| `POST /auth/login` | no | 400, 401, 403 (`email_not_verified`), 429, 500, 503 | Intercambia email/contraseña por un access token; el refresh viaja en cookie `httpOnly` |
| `POST /auth/register` | no | 400, 429, 500, 503 | Crea la cuenta; la respuesta no revela si el email ya existía |
| `POST /auth/refresh` | no (cookie `httpOnly`) | 401, 429, 500, 503 | Renueva el par de tokens desde la cookie |
| `POST /auth/logout` | no | 429, 500 | Limpia la cookie del refresh (sin revocación en el proveedor) |
| `POST /companies` | sí | 400, 401, 403 (`user_not_provisioned`), 429, 500 | Crea una empresa con la membership `OWNER` en una transacción |
| `GET /companies` | sí | 401, 403 (`user_not_provisioned`), 429, 500 | Lista las empresas del usuario |
| `GET /me` | sí | 401, 403 (`user_not_provisioned`), 429, 500 | Devuelve la identidad del usuario (incluido `fullName`, `null` si todavía no lo cargó) y sus membresías activas con empresa y rol |
| `PATCH /me` | sí | 400, 401, 403 (`user_not_provisioned`), 429, 500 | Fija o borra el `fullName` del usuario autenticado (`null`, `""` o solo espacios lo borran; el tope es 120 caracteres tras trim) y responde la misma representación que `GET /me` |
| `GET /companies/{companyId}/context` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden`), 429, 500 | Resuelve la empresa y el rol del usuario |
| `POST /companies/{companyId}/media/signature` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden`), 429, 500 | Firma los parámetros de subida directa |
| `GET /companies/{companyId}/members` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden`), 429, 500 | Lista el roster: memberships `ACTIVE` e `INVITED`, nunca una `REVOKED` |
| `POST /companies/{companyId}/members` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden` / `insufficient_role`), 409, 429, 500 | Invita por email creando una membership `INVITED`; el `409` es un email que ya tiene membership `ACTIVE` o `INVITED` |
| `PATCH /companies/{companyId}/members/{membershipId}` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden` / `insufficient_role`), 404 (`membership_not_found`), 409 (`last_active_owner`), 429, 500 | Cambia el rol de una membership; nadie cambia el suyo y la empresa conserva un `OWNER` activo |
| `DELETE /companies/{companyId}/members/{membershipId}` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden` / `insufficient_role`), 404 (`membership_not_found`), 409 (`last_active_owner`), 429, 500 | Revoca una membership (`status = REVOKED`, la fila queda) |
| `DELETE /companies/{companyId}/members/me` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden`), 404 (`membership_not_found`), 409 (`last_active_owner`), 429, 500 | Sale de la empresa revocando su propia membership; el último `OWNER` activo no puede salir |
| `GET /companies/{companyId}/products?search=&deleted=` | sí | 400, 401, 403 (`company_access_forbidden`), 429, 500 | Lista los productos no dados de baja, ordenados por nombre y luego por id; `search` compara por subcadena contra nombre o SKU. `deleted=true` lista **solo** los dados de baja (la papelera), con la misma búsqueda y el mismo orden; el default sigue siendo el catálogo activo |
| `POST /companies/{companyId}/products` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden` / `insufficient_role`), 409 (`sku_already_exists`), 429, 500 | Da de alta un producto (el SKU se normaliza a mayúsculas) y responde `201` |
| `GET /companies/{companyId}/products/{productId}` | sí | 400, 401, 403 (`company_access_forbidden`), 404 (`product_not_found`), 429, 500 | Lee un producto; uno de otra empresa y uno dado de baja responden el mismo 404 |
| `PATCH /companies/{companyId}/products/{productId}` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden` / `insufficient_role`), 404 (`product_not_found`), 409 (`sku_already_exists`), 429, 500 | Edición parcial: un campo ausente no cambia y un `null` limpia `description` o `photoUrl` |
| `DELETE /companies/{companyId}/products/{productId}` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden` / `insufficient_role`), 404 (`product_not_found`), 429, 500 | Baja lógica (`deletedAt`) que responde `204` y conserva el SKU reservado |
| `POST /companies/{companyId}/products/{productId}/restore` | sí | 400, 401, 403 (`user_not_provisioned` / `company_access_forbidden` / `insufficient_role`), 404 (`product_not_found`), 409 (`product_not_deleted`), 429, 500 | Restaura un producto dado de baja (limpia `deletedAt`) y responde `200` con el producto activo, su SKU y su historial; comparte el permiso de la baja (`manage_products`). La purga física no existe |
| `GET /companies/{companyId}/movements?productId=&customerId=&type=&limit=` | sí | 400, 401, 403 (`company_access_forbidden`), 429, 500 | Historial de la empresa, más recientes primero; `productId`, `customerId` y `type` filtran (combinables entre sí) y `limit` va de `1` a `200` (default `50`). `customerId` es un filtro de lectura, no un recurso: un id de otra empresa no devuelve filas en vez de un `404`. Cada movimiento trae el producto, el usuario y el cliente resueltos por la API: `customer` es `null` cuando no hay asociación y **sigue resolviéndose después de la baja lógica del cliente** |
| `POST /companies/{companyId}/movements` | sí | 400 (`customer_requires_exit`), 401, 403 (`company_access_forbidden`), 404 (`product_not_found` / `customer_not_found`), 409 (`insufficient_stock`), 429, 500 | Registra una entrada `IN` o una salida `OUT` aplicando el stock en la misma transacción y responde `201` con el movimiento y el stock resultante. Acepta un `customerId` opcional que **sólo es válido con `type: OUT`**; el cliente se valida antes de escribir, así que un rechazo no toca el stock |
| `GET /companies/{companyId}/reports/movements?days=` | sí | 400, 401, 403 (`company_access_forbidden`), 429, 500 | Reporte del dashboard: entradas y salidas **por día UTC**, del más viejo al más nuevo y con los días sin movimientos en cero; `days` va de `1` a `90` (default `30`) |
| `GET /companies/{companyId}/customers?search=` | sí | 400, 401, 403 (`company_access_forbidden`), 429, 500 | Lista los clientes activos ordenados por nombre y luego por id; `search` compara por subcadena, sin distinguir mayúsculas, contra nombre, email o teléfono |
| `POST /companies/{companyId}/customers` | sí | 400, 401, 403 (`company_access_forbidden`), 429, 500 | Da de alta un cliente y responde `201`; escribe cualquier membership `ACTIVE` |
| `GET /companies/{companyId}/customers/{customerId}` | sí | 400, 401, 403 (`company_access_forbidden`), 404 (`customer_not_found`), 429, 500 | Lee un cliente; uno de otra empresa y uno dado de baja responden el mismo 404 |
| `PATCH /companies/{companyId}/customers/{customerId}` | sí | 400, 401, 403 (`company_access_forbidden`), 404 (`customer_not_found`), 429, 500 | Edición parcial: un campo ausente no cambia y un `null` (o un valor en blanco) limpia `email`, `phone` o `address` |
| `DELETE /companies/{companyId}/customers/{customerId}` | sí | 400, 401, 403 (`company_access_forbidden`), 404 (`customer_not_found`), 429, 500 | Baja lógica (`deletedAt`) que responde `204`; un segundo `DELETE` responde `404` |
| `GET /me/invitations` | sí | 401, 403 (`user_not_provisioned`), 429, 500 | Lista las invitaciones pendientes del usuario autenticado; sin nada pendiente responde `200` con `[]` |
| `POST /me/invitations/accept` | sí | 401, 403 (`user_not_provisioned`), 429, 500 | Acepta todas las invitaciones pendientes; es idempotente y no lleva body |
| `GET /me/notifications` | sí | 401, 403 (`user_not_provisioned`), 429, 500 | Lista las notificaciones del usuario, más recientes primero; sin novedades responde `200` con `[]` |
| `POST /me/notifications/read` | sí | 401, 403 (`user_not_provisioned`), 429, 500 | Marca todas las notificaciones del usuario como leídas y responde `204` |

### Aislamiento por empresa (el punto crítico)

No se usa **Row Level Security** de Supabase, así que **el aislamiento entre empresas depende por
completo del código de la aplicación**. Hoy hay tres piezas que lo materializan:

- **En el repositorio**, el listado filtra por memberships `ACTIVE` (`findAllForUser`) y el alta
  crea la empresa y la membership del dueño en **una sola transacción** (`createOwnedBy`).
- **En el HTTP**, `requireCompanyContext` valida en cada request que el usuario tiene una membership
  `ACTIVE` en la empresa del path (`/companies/:companyId/*`) y resuelve su rol. Un no-miembro y una
  empresa inexistente responden el mismo 403 (`company_access_forbidden`) para que los ids no se
  puedan enumerar.
- **En cada consulta de producto o de cliente**, el `companyId` viaja en el `WHERE` y nunca en un
  filtro posterior sobre lo ya leído, y el repositorio excluye las filas con `deletedAt` en las
  lecturas normales (la papelera, `?deleted=true`, las lee pero conserva el mismo `companyId` en el
  `WHERE`): un producto (o un cliente) de otra empresa y uno inexistente responden el mismo `404`
  (`product_not_found`, `customer_not_found`).

El límite honesto: esto cubre lo que está construido (empresas, contexto, firma de media, miembros,
productos, movimientos, clientes y el reporte del dashboard, que lee con `where: { companyId,
createdAt: { gte: since } }`). Cualquier recurso nuevo por empresa **debe colgarse del mismo
sub-router protegido**, no inventar un camino nuevo a la membership. Sigue siendo el mayor riesgo de
seguridad del proyecto: cada consulta nueva debe filtrar por `company_id` y traer su test.

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
| `apps/web` | <http://localhost:3000> |
| `apps/api` | <http://localhost:3001> (`GET /health`) · `/docs` (Swagger UI) |

Para levantar una sola app:

```sh
bun run dev --filter=web
```

### Scripts disponibles

Todos desde la raíz del monorepo:

| Comando | Qué hace |
| --------- | ---------- |
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
| ---------- | ---------- |
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

### Core de inventario (Fase 2 y 3)

- [x] **Dashboard con datos reales** — MI-6: los cuatro KPIs (total de productos, valor del inventario, productos con stock crítico y unidades movidas hoy en UTC), las alertas y la tabla de stock crítico se derivan de `GET /companies/{id}/products` y del reporte de evolución, y el aviso "Datos de muestra" se eliminó porque ya no había datos de muestra. Los gráficos ya eran reales (MI-14). MI-9 nombra el **historial de movimientos**, que está construido desde MI-8 (`/dashboard/movements`): no queda nada mockeado en el dashboard.
- [x] **Entradas y salidas de stock** — MI-8 (vista MI-26): stock atómico, historial y auditoría.
- [x] **CRUD de clientes** — MI-11 (vista MI-24): CRUD por empresa, baja lógica y búsqueda por nombre, email o teléfono.
- [x] **Vinculación de clientes a las salidas** — MI-10 (CLI-04): `customerId` opcional sólo en `OUT` (`400 customer_requires_exit` / `404 customer_not_found` antes de tocar el stock), selector "Sin cliente" en el formulario de salida y columna Cliente en el historial. El resumen de compras por cliente (columnas "Compras"/"Total") sigue sin construirse.
- [ ] **Purga física de productos** — feature aparte sobre la misma papelera: `DELETE` definitivo, OWNER-only, con modal de confirmación y bloqueado cuando el producto tiene movimientos (`stock_movements.product_id` es `ON DELETE RESTRICT`). No está implementada: hoy lo único que recupera un producto es la baja lógica reversible (**Restaurar**).
- [ ] **Notificaciones de stock bajo** — MI-12.

### Polish (Fase 4)

- [ ] **Recuperación de contraseña** — MI-16.
- [x] **Gráficos** — MI-14 (DASH-02): tres gráficos con datos reales de la empresa activa en Recharts —distribución del stock por estado, valor del inventario en centavos enteros y evolución de entradas/salidas por día UTC desde `GET /companies/{id}/reports/movements?days=`—. El desglose por categoría espera la feature de categorías.
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
