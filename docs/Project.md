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

> **Estado (MI-6, `odd/tasks/dashboard-metrics.md`; gráficos en MI-14):** el dashboard ya **no muestra
datos de muestra**: los cuatro KPIs, las alertas y la tabla de stock crítico se derivan de dos
lecturas de la empresa activa —`GET /companies/{companyId}/products`, que devuelve el catálogo
completo sin paginar, y el reporte de evolución de los últimos 30 días— **sin endpoint nuevo**. El
aviso "Datos de muestra" se eliminó porque ya no era cierto. **DASH-01** (total de productos activos)
es real (el tamaño del catálogo); **DASH-03** (tabla de stock crítico) es real y usa el predicado
`stockQuantity <= lowStockThreshold` —hoy el umbral es siempre 0, así que la tabla son los
**agotados**; cuando MI-12 permita editarlo, la misma regla cubre el stock bajo sin tocar el
dashboard—, ordenada por unidades ascendente y luego por nombre, con las columnas Producto, SKU,
Categoría (**—** mientras no exista la feature), Precio, Unidades y Estado (`StockBadge`); **DASH-04**
(valor del inventario) es real **en la tarjeta y en el gráfico**, ambos calculados en el cliente en
**centavos enteros** desde el precio decimal por el stock con el mismo helper, así que muestran el
mismo total; **DASH-05** lo resuelve el contexto de empresa (la empresa activa: el catálogo y el
reporte ya vienen filtrados por `companyId`), no un filtro nuevo. **DASH-02** se cumple
**parcialmente**: el gráfico de distribución del stock es por **estado** (agotados contra con stock),
**no por categoría**, porque la feature de categorías no existe y el `categoryId` de todos los
productos es nulo —un gráfico por categoría mostraría una sola porción "Sin categoría"—; el
**desglose por categoría queda pendiente de esa feature** y la reemplazará, no se sumará como cuarto
gráfico. Librería: **Recharts**, que ya estaba en el stack. Los tres gráficos son: **distribución del
stock por estado**; **valor del inventario**, con el total de la empresa y las barras de los 8
productos de mayor valor; y **evolución de entradas/salidas** por **día UTC**, del más viejo al más
nuevo y con los días sin movimientos en cero, desde
`GET /companies/{companyId}/reports/movements?days=` (`days` entero de `1` a `90`, default `30`).

### 3. Gestión de Productos

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| PROD-01 | Creación de productos con: nombre, descripción, precio, foto, código SKU | Alta |
| PROD-02 | Edición de datos de productos existentes | Alta |
| PROD-03 | Eliminación lógica de productos (soft delete, reversible) | Alta |
| PROD-04 | Búsqueda y filtrado de productos por nombre, SKU o categoría | Alta |
| PROD-05 | Validación de unicidad de SKU por empresa | Alta |
| PROD-06 | Carga de imagen del producto (optimización incluida) | Media |

> **Estado (MI-7, `odd/tasks/products.md`):** el alta, la edición y la baja lógica (PROD-01, PROD-02,
> PROD-03) están implementadas, igual que la unicidad de SKU por empresa (PROD-05, con el SKU
> normalizado a mayúsculas porque el índice `UNIQUE` de Postgres distingue grafía) y la foto
> (PROD-06). PROD-04 se cumple **sólo por nombre y por SKU**: el **filtro por categoría no está
> implementado** porque todavía no existe la feature de categorías (ni CRUD, ni endpoint, ni UI) y
> `categoryId` no se expone en el contrato; entra cuando esa feature exista. PROD-06 se resuelve con
> **subida directa firmada** a Cloudinary: el formulario pide la firma a
> `POST /companies/{companyId}/media/signature`, sube el archivo y guarda únicamente el `secure_url`;
> la optimización es la entrega de Cloudinary, no un paso de código propio. Crear y editar
> confirman con un toast y vuelven al listado.
>
> **PROD-03 es una baja lógica reversible** (`odd/tasks/product-restore.md`): la baja estampa
> `deletedAt` y la restauración la deshace con
> `POST /companies/{companyId}/products/{productId}/restore`, que devuelve el producto activo con su
> SKU y su historial de movimientos intactos y exige el mismo permiso que la baja (`manage_products`,
> ADMIN u OWNER). La papelera lee **solo** las bajas
> (`GET /companies/{companyId}/products?deleted=true`, con la misma búsqueda y el mismo orden; el
> default sigue siendo el catálogo activo) y restaurar uno que no está dado de baja responde `409
> product_not_deleted` (la papelera es un estado, no un flag); uno de otra empresa responde el mismo
> `404` que uno inexistente. El SKU **sigue reservado** mientras el producto está dado de baja —el
> índice único cubre las filas con `deletedAt`—, así que recrearlo responde `409 sku_already_exists`
> y **restaurar es la forma de reutilizarlo** mientras la fila siga en la papelera.
>
> **La purga física está implementada** (`odd/tasks/product-purge.md`): `DELETE
> /companies/{companyId}/products/{productId}/permanent` borra la fila y responde `204`; es la segunda
> mitad de la papelera —restaurar o purgar— y la única forma de **liberar el SKU**, porque la fila y su
> índice único desaparecen, así que un producto nuevo puede volver a usar ese código. Es **solo para el
> `OWNER`**: `purge_products` es una fila propia de la matriz, separada de `manage_products` porque la
> operación es irreversible, y un `ADMIN` recibe `403 insufficient_role` aunque pueda dar de baja y
> restaurar. Solo se permite sobre un producto **ya dado de baja** (`409 product_not_deleted`, la
> papelera es el único punto de entrada) y **sin movimientos** (`409 product_has_movements`, con el
> conteo): el ledger es la traza de auditoría (MOV-05) y **no se borra nunca**, y
> `stock_movements.product_id` es `ON DELETE RESTRICT`, la última guarda —un movimiento creado entre el
> conteo y el `DELETE` también responde ese `409`, nunca un `500`—. En la UI, la papelera ofrece
> **Eliminar definitivamente** junto a **Restaurar** únicamente al `OWNER`, detrás del `Modal` de
> confirmación (danger) que advierte que es irreversible y que solo se permite sin movimientos; el
> `409` se muestra adentro del diálogo con el mensaje de la API.

### 4. Entradas y Salidas de Inventario

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| MOV-01 | Registro de entrada de stock (compra, ajuste, devolución) | Alta |
| MOV-02 | Registro de salida de stock (venta, ajuste, daño) | Alta |
| MOV-03 | Historial de movimientos por producto | Alta |
| MOV-04 | Actualización automática del stock disponible | Alta |
| MOV-05 | Registro de usuario, fecha y motivo en cada movimiento | Media |

> **Estado (MI-8, `odd/tasks/movements.md`):** MOV-01 a MOV-05 están implementados. El alta (`POST
> /companies/{companyId}/movements`) registra una entrada (`IN`) o una salida (`OUT`) y responde `201`
> con el movimiento y el `stockQuantity` del producto **después** de él (MOV-01, MOV-02); el historial
> (`GET /companies/{companyId}/movements?productId=&customerId=&type=&limit=`, más recientes primero)
> cubre MOV-03. `customerId` es un **filtro de lectura** opcional y combinable con `productId`, `type` y
> `limit`: un id que no pertenece a la empresa no devuelve filas en vez de responder `404`, y el
> `companyId` sigue siendo obligatorio en la consulta. Ese filtro es el que alimenta el detalle de un
> cliente (ver la nota de la sección 5). La escritura del movimiento y el cambio de stock van en **una
> sola transacción** (MOV-04) y la salida se aplica con un update guardado por `stockQuantity >=
> quantity`, así que dos salidas concurrentes no pueden dejar stock negativo: la perdedora responde
> `409 insufficient_stock` con el stock disponible y no registra nada. El formulario confirma con un
> toast el stock resultante de la transacción y muestra los rechazos con el mensaje de la API en ese
> mismo toast. Los movimientos son **inmutables** —no hay endpoints de edición
> ni de borrado— porque son la traza de auditoría de MOV-05, con el `userId` y el `createdAt` puestos
> por el servidor y `reason` opcional (≤300 caracteres). Cualquier membership `ACTIVE` registra y todos
> los roles leen el historial. La tabla del historial suma la columna **Total**: el precio escrito en el
> movimiento × la cantidad, multiplicado en **centavos enteros**, y **desconocido** ("sin total") para
> una entrada o una venta sin precio escrito, nunca `0`. Es un total **por movimiento**, no un total de
> dinero de la empresa. **Desde MI-10 (`odd/tasks/customer-links.md`) una salida puede
> asociarse a un cliente**: `customerId` se acepta opcional y nullable en el alta y se expone en el
> historial ya resuelto (`customerId` más `customer: { id, name } | null`). La lectura por lote de
> clientes incluye las filas con `deletedAt`, así que un movimiento **sigue mostrando el nombre del
> cliente después de su baja lógica**: el ledger es la traza de auditoría de MOV-05 y dar de baja un
> cliente no borra ni altera sus movimientos. Sin migración: `customer_id` existe desde la migración
> inicial.

### 5. Gestión de Clientes

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| CLI-01 | Creación de clientes con datos de contacto | Alta |
| CLI-02 | Edición de información de clientes | Alta |
| CLI-03 | Eliminación lógica de clientes | Media |
| CLI-04 | Asociación de clientes a movimientos de salida (ventas) | Media |
| CLI-05 | Listado y búsqueda de clientes | Media |

> **Estado (MI-11, `odd/tasks/customers.md`):** CLI-01, CLI-02, CLI-03 y CLI-05 están implementados:
alta, edición parcial y baja lógica de clientes, más el listado con búsqueda por nombre, email o
teléfono (subcadena, sin distinguir mayúsculas; orden por nombre y luego id). La **baja es lógica**
(`deletedAt`): el cliente desaparece del listado y de las lecturas, y un segundo `DELETE` responde
`404`. La autorización es una decisión explícita del humano: **cualquier membership `ACTIVE` crea,
edita y da de baja**, y todos los roles leen; el guard es el contexto de empresa, así que no hay una
fila nueva en la matriz de autorización. `email`, `phone` y `address` son opcionales y un valor vacío
se guarda como `null`; **no hay unicidad de email** porque el esquema no define índice único.
**CLI-04 (asociar clientes a los movimientos de salida) está implementado** (MI-10,
`odd/tasks/customer-links.md`): el alta de un movimiento acepta `customerId` **opcional y nullable**
y **sólo con `type: "OUT"`** —una entrada con cliente responde `400 customer_requires_exit`, porque
una compra a proveedor no es una venta del cliente—, y el cliente debe existir, estar activo y
pertenecer a la empresa o el alta responde `404 customer_not_found` (idéntico para ajeno, inexistente
y dado de baja). Las dos validaciones corren **antes** de la escritura atómica, así que el movimiento
rechazado no registra fila ni mueve el stock. La asociación es **opcional**: una venta sin cliente
identificado sigue siendo válida y se guarda con `customerId: null`. En la UI, el formulario de salida
suma el selector opcional (con la opción "Sin cliente") y el historial suma la columna Cliente. **El
resumen de compras por cliente (columnas "Compras"/"Total") no forma parte de MI-10** (decisión L4):
el padrón sigue mostrando sólo los datos de contacto.

> **Estado (vista de detalle, `odd/tasks/customer-detail.md`):** en `/dashboard/clients` la acción
> **Detalle** abre un panel **en la misma página** con los datos de contacto y la tabla de **sus
> salidas** (`type=OUT`) —fecha, producto, SKU, cantidad, motivo y usuario—, más el conteo de salidas y
> el total de unidades **de las salidas listadas** (el panel aclara "Se muestran las salidas más
> recientes", porque el endpoint pagina el historial: no promete un total histórico). Cada fila suma el
> **precio de venta** escrito en esa salida y su **total** (`precio × cantidad`, en centavos enteros):
> son los del movimiento y no los del catálogo, así que una venta conserva el precio que se cobró y una
> salida anterior al precio escrito muestra "sin precio"/"sin total", nunca `0`. No es un requerimiento
> nuevo: es una **vista sobre CLI-03/CLI-05/MOV-03**. No agrega endpoints —reutiliza
> `GET /companies/{companyId}/movements` con `customerId`, un filtro de lectura que en un cliente de
> otra empresa devuelve `[]` en vez de `404`— ni filas a `can()`, porque leer clientes y movimientos ya
> está permitido a cualquier membership `ACTIVE`. La página de Movimientos queda igual: el detalle es
> adicional y de solo lectura, y el resumen de compras por cliente sigue fuera de alcance.

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

- [x] CRUD de Productos (con SKU y foto)
- [x] Dashboard con métricas básicas (MI-6: cuatro KPIs, alertas y tabla de stock crítico con datos reales)
- [x] Entradas y salidas de stock
- [x] Historial de movimientos

### Fase 3 — Clientes y Alertas

- [x] CRUD de Clientes
- [x] Vinculación de clientes a salidas
- [ ] Notificaciones de stock bajo en UI

### Fase 4 — Polish

- [x] Gráficos en el dashboard (MI-14: distribución del stock por estado, valor del inventario y evolución de entradas/salidas por día UTC)
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
