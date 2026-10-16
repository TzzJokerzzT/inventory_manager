# Inventory Manager

Sistema de gestión de inventarios multi-empresa. Permite a los usuarios administrar productos, clientes, entradas/salidas de stock y recibir alertas de inventario bajo, con soporte para múltiples empresas bajo un mismo usuario.

---

## 📋 Requerimientos Funcionales

### 1. Autenticación de Usuarios

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| AUTH-01 | Registro de nuevos usuarios con email y contraseña | Alta |
| AUTH-02 | Inicio de sesión con credenciales válidas | Alta |
| AUTH-03 | Cierre de sesión seguro | Alta |
| AUTH-04 | Recuperación de contraseña por email | Media |
| AUTH-05 | Gestión de sesiones (JWT o similar) | Alta |

### 2. Dashboard de Inventario

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| DASH-01 | Visualización del número total de productos activos | Alta |
| DASH-02 | Gráficos de distribución de stock (por categoría, estado, etc.) | Media |
| DASH-03 | Tabla resumen de productos con stock crítico | Alta |
| DASH-04 | Indicador de valor total del inventario | Media |
| DASH-05 | Filtrado por empresa (si el usuario tiene múltiples) | Alta |

### 3. Gestión de Productos

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| PROD-01 | Creación de productos con: nombre, descripción, precio, foto, código SKU | Alta |
| PROD-02 | Edición de datos de productos existentes | Alta |
| PROD-03 | Eliminación lógica de productos (soft delete) | Alta |
| PROD-04 | Búsqueda y filtrado de productos por nombre, SKU o categoría | Alta |
| PROD-05 | Validación de unicidad de SKU por empresa | Alta |
| PROD-06 | Carga de imagen del producto (optimización incluida) | Media |

### 4. Entradas y Salidas de Inventario

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| MOV-01 | Registro de entrada de stock (compra, ajuste, devolución) | Alta |
| MOV-02 | Registro de salida de stock (venta, ajuste, daño) | Alta |
| MOV-03 | Historial de movimientos por producto | Alta |
| MOV-04 | Actualización automática del stock disponible | Alta |
| MOV-05 | Registro de usuario, fecha y motivo en cada movimiento | Media |

### 5. Gestión de Clientes

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| CLI-01 | Creación de clientes con datos de contacto | Alta |
| CLI-02 | Edición de información de clientes | Alta |
| CLI-03 | Eliminación lógica de clientes | Media |
| CLI-04 | Asociación de clientes a movimientos de salida (ventas) | Media |
| CLI-05 | Listado y búsqueda de clientes | Media |

### 6. Gestión Multi-Empresa

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| EMP-01 | Creación de empresa con datos fiscales y de contacto | Alta |
| EMP-02 | Un usuario puede crear y administrar múltiples empresas | Alta |
| EMP-03 | Los productos, clientes y movimientos están **aislados por empresa** | Alta |
| EMP-04 | Switch de contexto entre empresas desde la interfaz | Alta |
| EMP-05 | Edición de datos de la empresa | Media |
| EMP-06 | Varias personas pueden acceder a la **misma** empresa, cada una con su propia cuenta | Alta |
| EMP-07 | Un OWNER o ADMIN asigna a un usuario a su empresa con un rol (`OWNER`, `ADMIN`, `MEMBER`) | Alta |
| EMP-08 | El usuario asignado debe **aceptar** antes de acceder a los datos de la empresa | Alta |
| EMP-09 | El listado de usuarios muestra sólo los vinculados a las empresas del propio usuario | Alta |
| EMP-10 | Un usuario puede salir de una empresa, salvo si es su último OWNER activo | Media |

### 7. Notificaciones de Stock Bajo

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| NOTIF-01 | Configuración de umbral mínimo de stock por producto | Alta |
| NOTIF-02 | Alerta visual en el dashboard cuando un producto está por debajo del umbral | Alta |
| NOTIF-03 | Listado de productos con stock bajo | Alta |
| NOTIF-04 | (Futuro) Notificaciones por email de stock crítico | Baja |

---

## 🏗️ Requerimientos No Funcionales

| ID | Requerimiento |
| ---- | --------------- |
| RNF-01 | Arquitectura desacoplada (API REST + Frontend) |
| RNF-02 | Base de datos con soporte para multi-tenancy por empresa |
| RNF-03 | Autenticación stateless (JWT) |
| RNF-04 | Validación de datos en backend y frontend |
| RNF-05 | Manejo de errores consistente en toda la API |
| RNF-06 | Diseño responsive para uso en desktop y tablet |

---

## 🗂️ Entidades Principales

```
User
├── id, auth0_sub, email, full_name, created_at, updated_at
│   sin password_hash: las credenciales las custodia Auth0, el backend sólo valida el JWT
│
Membership            ← une User con Company; habilita varios usuarios por empresa
├── id, user_id (nullable hasta que la persona exista), invited_email, company_id,
│   role (OWNER|ADMIN|MEMBER), status (INVITED|ACTIVE|REVOKED), invited_by,
│   accepted_at, created_at, updated_at
│
Company
├── id, name, tax_id, address, phone, created_at, updated_at
│   sin owner_user_id: el dueño es la Membership con role = OWNER
│
Category              ← única por empresa (UNIQUE company_id + name)
├── id, company_id, name, created_at, updated_at
│
Product
├── id, company_id, name, description, sku, price, photo_url,
│   stock_quantity, low_stock_threshold, category_id (nullable), created_at, updated_at, deleted_at
│
Customer
├── id, company_id, name, email, phone, address, created_at, updated_at, deleted_at
│
StockMovement         ← inmutable: sólo created_at, sin updated_at
├── id, product_id, company_id, type (IN|OUT), quantity,
│   reason, user_id, customer_id (nullable), created_at
```

---

## 📅 Roadmap / Fases

> El mapa completo de lo pendiente — con dependencias, bloqueantes, decisiones abiertas y camino
> crítico — está en [`plan-de-trabajo.md`](./plan-de-trabajo.md).

### Fase 0 — Diseño

- [x] Creación del diseño de la aplicación (wireframes, sistema de diseño, mockups) → `design/inventory-manager.fig`

### Fase 1 — Fundamentos

- [ ] **Setup del proyecto (backend + frontend)** — **[MI-2](https://alexbuelvas92.atlassian.net/browse/MI-2)**, en progreso. **11 de 15 configuraciones
      ya hechas** (monorepo, Biome, entorno local, comandos en el README, base de la API con Clean
      Architecture, design system con modo oscuro, control de versiones, **Prisma + Supabase** —
      schema, migración `20261006223356_init` aplicada y adaptador `PrismaCompanyRepository`
      cableado —, **Auth0** — tenant verificado y validación del JWKS cableada sobre `/companies` —,
      **los tests** — Jest como único runner y Cypress para E2E — y **la CI** —
      `.github/workflows/ci.yml` con los jobs `verify` y `migrations`). Pendientes, como
      subtareas de MI-2: **MI-37** `.env.example` de la raíz · **MI-40** Cloudinary ·
      **MI-42** Husky · **MI-43** contrato frontend ↔ backend. **MI-38, MI-39 y MI-36 quedaron
      `Done`** (2026-10-06) y **MI-51** también, con el esquema del acceso multi-usuario dentro de esa
      misma migración.
- [ ] **Autenticación (register, login, logout)** — **[MI-3](https://alexbuelvas92.atlassian.net/browse/MI-3)**; depende de
      **MI-39** (Auth0). Incluye el modelo de membresías y roles por empresa
      (`docs/stack.md` §5.8) y el registro abierto con email verificado.
- [ ] **CRUD de Empresas** — **[MI-4](https://alexbuelvas92.atlassian.net/browse/MI-4)**; depende de **MI-38** (Prisma +
      Supabase) y **MI-43** (contrato). Incluye el bootstrap: al registrarse, crear la empresa y quedar
      como `OWNER` de ella.
- [ ] **Middleware de aislamiento por empresa** — **[MI-5](https://alexbuelvas92.atlassian.net/browse/MI-5)**; depende de
      **MI-38**; es el mayor riesgo de seguridad del proyecto (no hay Row Level Security). Debe resolver
      `auth0_sub → user_id` y validar la membership en **cada** request, nunca confiar el `company_id`
      que manda el cliente.

### Fase 2 — Core de Inventario

- [ ] CRUD de Productos (con SKU y foto)
- [ ] Dashboard con métricas básicas
- [ ] Entradas y salidas de stock
- [ ] Historial de movimientos

### Fase 3 — Clientes y Alertas

- [ ] CRUD de Clientes
- [ ] Vinculación de clientes a salidas
- [ ] Notificaciones de stock bajo en UI

### Fase 4 — Polish

- [ ] Gráficos en el dashboard
- [ ] Filtros y búsquedas avanzadas
- [ ] Recuperación de contraseña
- [ ] Notificaciones por email

---

## 🎨 Diseño (Fase 0 · MI-17)

El diseño v1 vive en `design/inventory-manager.fig` (OpenPencil) y cubre el sistema de diseño,
los mockups y el flujo de navegación.

| Página | Contenido |
| -------- | ----------- |
| 01 · Design System | Paleta, escala tipográfica, botones, badges, formularios, KPI, alertas y tabla densa |
| 02 · Mockups | Login, Registro, Dashboard, Productos, Formulario de producto, Movimientos, Clientes, Tablet |
| 03 · Flujo de navegación | Acceso → empresa → app shell → módulos, más reglas del sistema |
| 04 · Modo oscuro | Especificación de los 19 tokens de color (claro/oscuro/uso) + Dashboard en oscuro como vista de referencia |

**Dirección visual:** SaaS admin moderno · sidebar oscuro · tipografía Inter · primario indigo
`#4F46E5` · semánticos success/warning/danger/info · grid de 4 px · controles de 48 px.

**Tokens:** 28 variables en la colección `Inventory Manager / Tokens` (19 colores, 6 espaciados,
3 radios) con **dos modos** (claro y `Dark`), exportables a CSS/Tailwind.

**Modo oscuro:** mismo nombre de token, distinto valor. El fondo es `#0B1120`, la superficie
`#131C2E` y los acentos se aclaran (`primary` `#6366F1`) para conservar contraste. La elevación se
expresa con superficie más clara, no con sombras.

**Accesibilidad:** el estado nunca se comunica solo con color; contrasto AA en badges y alertas.

---

## 🛠️ Stack Tecnológico (decidido)

> Detalle completo: **[`stack.md`](./stack.md)** · Tarea: **MI-1**

| Capa | Decisión |
| ------ | ---------- |
| **Tipo de proyecto** | Monorepo con **Turborepo** |
| **Frontend** | SPA con **React + Next.js + TypeScript** · arquitectura **Vertical Slice** |
| **Backend** | API REST con **Node + Express + TypeScript** · arquitectura **Clean Architecture** |
| **Base de datos** | **PostgreSQL** en **Supabase** (Postgres gestionado) |
| **ORM** | **Prisma** |
| **Autenticación** | **Auth0** (OIDC) — el backend **valida** el JWT, no lo emite |
| **Storage de imágenes** | **Cloudinary**, con **subida directa** desde el cliente |
| **Hosting** | **Vercel** |
| **CI/CD** | **GitHub Actions** |
| **Contenedores** | No se usan |

**Frontend:** Axios · Zustand · TanStack Query · Valibot · shadcn/ui ·
Framer Motion · Recharts · Tailwind CSS · lucide-react · Biome · Jest · React Testing Library ·
Cypress · Husky

**Backend:** express · cors · helmet · cookie-parser · morgan · express-rate-limit · prisma ·
express-oauth2-jwt-bearer · express-validator · Valibot · cloudinary · swagger + yamljs ·
dotenv · http-status-codes · Biome · Jest · supertest

**Base de datos:** PostgreSQL como motor (última estable soportada por Supabase); Supabase aporta
el Postgres gestionado y el **pooler (Supavisor)** obligatorio para serverless, con **Prisma** como
ORM. **No** se usan las migraciones de Supabase (se usa Prisma), ni Storage (va a Cloudinary), ni
Auth/GoTrue (el proveedor es **Auth0**), ni Row Level Security: el **aislamiento por empresa vive
en la capa de aplicación**, no en la base.

**Autenticación:** **Auth0** como proveedor de identidad. El backend **valida** el JWT contra su
JWKS, no lo emite. Quedan **fuera del stack** `bcrypt`, `jsonwebtoken` y `multer`. La recuperación
de contraseña (AUTH-04), el MFA y el login social los provee Auth0.

> **Riesgos abiertos documentados:** Express en Vercel es serverless (el rate limit en memoria no
> limita globalmente, `morgan` no conserva logs, timeout de ~10 s), y Prisma puede agotar el pool
> de conexiones. Ver [observaciones](./stack.md#5-observaciones-técnicas) y
> [pendientes abiertos](./stack.md#62-pendientes-abiertos).

---

## 🚀 Primeros Pasos

1. ~~Definir stack tecnológico~~ ✅ ([`stack.md`](./stack.md))
2. Inicializar repositorios (backend / frontend)
3. Diseñar esquema de base de datos
4. Implementar autenticación
5. Crear CRUD de empresas con aislamiento de datos
