# Stack tecnológico — Inventory Manager

**Estado:** decidido y confirmado · **Tarea:** [MI-1] Escogencia del stack tecnológico
**Alcance:** stack completo (frontend, backend, base de datos, arquitectura y despliegue) para el MVP.

---

## Resumen

| Capa | Decisión |
|------|----------|
| **Tipo de proyecto** | Monorepo con **Turborepo** |
| **Frontend** | SPA con **React + Next.js + TypeScript** |
| **Arquitectura frontend** | **Vertical Slice** |
| **Backend** | API REST con **Node + Express + TypeScript** |
| **Arquitectura backend** | **Clean Architecture** |
| **Base de datos** | **PostgreSQL** |
| **Plataforma de datos** | **Supabase** (Postgres gestionado, pooler, extensiones) |
| **ORM** | **Prisma** |
| **Autenticación** | **Auth0** (OIDC / OAuth 2.0) — el backend **valida** el JWT, no lo emite |
| **Storage de imágenes** | **Cloudinary**, con **subida directa** desde el cliente |
| **Hosting** | **Vercel** |
| **CI/CD** | **GitHub Actions** |
| **Contenedores** | No se usan |

---

## 1. Frontend

### 1.1 Base

- **React** para la capa de UI.
- **Next.js** como framework (App Router) sobre React.
- **TypeScript** en modo estricto.

### 1.2 Librerías

| Propósito | Librería |
|-----------|----------|
| Cliente HTTP / fetching | **Axios** |
| Autenticación (Auth0) | **validación del JWT en el backend** (`express-oauth2-jwt-bearer`); el frontend **no** usa SDK de Auth0 (ROPG mediado por el backend, ver 5.4) |
| Estado local (UI) | **Zustand** |
| Estado del servidor (caché, fetching) | **TanStack Query** |
| Validación de esquemas | **Valibot** |
| Componentes de UI | **shadcn/ui** |
| Animaciones | **Framer Motion** |
| Gráficos | **Recharts** |
| Estilos | **Tailwind CSS** |
| Iconos | **lucide-react** |
| Linter y formateo | **Biome** |
| Tests unitarios | **Jest** |
| Tests de integración | **React Testing Library** |
| Tests E2E | **Cypress** |
| Git hooks | **Husky** |

### 1.3 Criterios de organización

- **Vertical Slice:** cada funcionalidad vive en su propia carpeta y agrupa sus componentes,
  hooks, estado, servicios y tests. Nada de carpetas globales tipo `components/`,
  `hooks/`, `services/` como criterio principal de organización.
- **Zustand** solo para estado de UI (modales, filtros, empresa activa). Todo dato que venga
  del servidor se maneja con **TanStack Query** y su caché — nunca se duplica en Zustand.
- **shadcn/ui + Tailwind** consumen los tokens de diseño definidos en el design system
  (`design/inventory-manager.fig`): colores, radios y espaciados ya están especificados con
  sus dos modos (claro/oscuro).

---

## 2. Backend

### 2.1 Base

- **Node.js** como runtime.
- **Express** como framework HTTP.
- **TypeScript** en modo estricto.
- **Auth0** como proveedor de identidad: la API **valida** el JWT contra su JWKS, nunca lo emite.
- **Clean Architecture** (dominio → casos de uso → adaptadores → infraestructura).

### 2.2 Librerías

| Propósito | Paquete |
|-----------|---------|
| Framework HTTP | **express** |
| CORS | **cors** |
| Cabeceras de seguridad HTTP | **helmet** |
| Parseo de cookies | **cookie-parser** (opcional, ver 5.4) |
| Logging de requests HTTP | **morgan** |
| Rate limiting | **express-rate-limit** (store por definir, ver 6.2) |
| ORM | **prisma** |
| Validación del JWT de Auth0 | **express-oauth2-jwt-bearer** |
| Validación de requests | **express-validator** |
| Validación de esquemas | **Valibot** |
| Nube de archivos (imágenes) | **cloudinary** |
| Documentación de API | **swagger** + **yamljs** |
| Variables de entorno | **dotenv** |
| Constantes de código HTTP | **http-status-codes** |
| Linter y formateo | **Biome** |
| Tests unitarios | **Jest** |
| Tests de endpoints e integración | **supertest** |
| Hash de contraseñas | ~~bcrypt~~ — **innecesario**: las credenciales las custodia Auth0 |
| Tokens de sesión | ~~jsonwebtoken~~ — reemplazado por la validación del JWT de Auth0 |
| Subida de archivos | ~~multer~~ — la subida es **directa del cliente a Cloudinary** |

**Nota:** `bcrypt`, `jsonwebtoken` y `multer` quedan tachados porque las decisiones confirmadas los
dejan sin uso. Se documentan para que la limpieza del `package.json` sea explícita y no un descuido.

---

## 3. Base de datos

### 3.1 Motor y plataforma

| Aspecto | Decisión |
|---------|----------|
| Motor | **PostgreSQL** (última estable soportada por Supabase) |
| Plataforma | **Supabase** (Postgres gestionado) |
| ORM | **Prisma** |
| Acceso desde la API | Prisma Client sobre el **pooler de Supabase** |

**PostgreSQL** es el motor: modelo relacional, transacciones ACID, integridad referencial y tipos
ricos (`numeric`, `timestamptz`, `uuid`, `jsonb`). Encaja con el dominio porque el inventario exige
consistencia fuerte: una salida de stock y su movimiento deben confirmarse o fallar juntos.

**Supabase** aporta la capa gestionada. Qué se usa y qué no:

| Capacidad de Supabase | Uso en el proyecto |
|-----------------------|--------------------|
| Postgres gestionado | ✅ Base de datos principal |
| **Pooler (Supavisor, puerto 6543)** | ✅ Obligatorio: la API corre como funciones serverless en Vercel |
| Conexión directa (puerto 5432) | ✅ Solo para migraciones y administración |
| Migraciones propias de Supabase | ❌ Se usan las de **Prisma** (`schema.prisma` como fuente de verdad) |
| Extensiones (`pgcrypto`, `pg_trgm`) | ⚠️ `pg_trgm` por decidir, ver 6.2 |
| **Storage** | ❌ **Descartado** en favor de **Cloudinary** |
| **Auth (GoTrue)** | ❌ No se usa: el proveedor de identidad es **Auth0** |
| **Row Level Security** | ❌ No se usa: el aislamiento por empresa va en la capa de aplicación |
| Realtime / Edge Functions | ❌ Fuera del alcance del MVP |

> **Consecuencia importante:** al no usar RLS, **el aislamiento por empresa depende por completo del
> código de la API**. Cada consulta del repositorio debe filtrar por `company_id` y debe existir un
> test que lo verifique. Es el mayor riesgo de seguridad del proyecto.
>
> **Hecho de seguridad medido (load-bearing):** Supabase otorga CRUD completo a `anon`,
> `authenticated` y `service_role` en el esquema `public` **por defecto, pero sólo** para las tablas
> creadas por `postgres`/`supabase_admin`. Las tablas que crea el rol `prisma` **no reciben grants**
> (verificado con una tabla de prueba en una transacción revertida, y tras la migración para las
> siete tablas: `has_table_privilege` devuelve `false`). Consecuencia: mantener `public` es seguro
> **sólo mientras** las migraciones corran como `prisma`; cualquier tabla creada a mano por el
> editor SQL de Supabase quedaría **expuesta por la Data API por defecto**.

### 3.2 Esquema: implicancias del dominio

| Regla de negocio | Implementación en Postgres |
|------------------|----------------------------|
| SKU único **por empresa** (PROD-05) | `UNIQUE (company_id, sku)`, no un unique global |
| Aislamiento por empresa (EMP-03) | `company_id` en `products`, `customers`, `stock_movements` + índice compuesto |
| Borrado lógico (PROD-03, CLI-03) | `deleted_at timestamptz NULL`; las consultas filtran `deleted_at IS NULL` |
| Precio y valor de inventario | `numeric(12,2)` — nunca `float` para dinero |
| Stock | `integer NOT NULL CHECK (stock >= 0)` |
| Movimientos (MOV-04) | `type` enum (`IN`/`OUT`); `stock_movements` inmutable y el stock se actualiza en la misma transacción |
| Umbral de stock bajo (NOTIF-01) | `low_stock_threshold integer NOT NULL DEFAULT 0` |
| Identificadores | `uuid` con `gen_random_uuid()` (**confirmado**) |
| Usuarios (Auth0) | `auth0_sub` **UNIQUE**; **nunca** se guardan contraseñas ni hashes |
| Auditoría (MOV-05) | `created_at timestamptz DEFAULT now()` + `user_id` en movimientos |

> **CHECKs y minúsculas van a mano en la migración.** Prisma no modela `CHECK` constraints ni
> extensiones, así que `CHECK (stock_quantity >= 0)` y `CHECK (quantity > 0)` se escriben a mano en
> la primera migración (`20261006223356_init`). Ahí también se fuerza el invariante de minúsculas
> sobre `users.email` y `memberships.invited_email`: el email es la llave de unión del modelo de
> acceso (§5.8) y un índice único sobre `text` distingue mayúsculas, así que `Foo@x.com` no
> matchearía `foo@x.com` sin ese CHECK.

### 3.3 Migraciones y entornos

- `schema.prisma` sigue siendo la **fuente de verdad**, pero en Prisma 7 el `datasource` **ya no
  declara `url` ni `directUrl`** (`directUrl` fue **removido** en v7): la URL vive en
  `apps/api/prisma.config.ts` (`datasource.url`, leída de `DIRECT_URL`).
- El generador es `prisma-client` (no `prisma-client-js`) con `output` **obligatorio**. El cliente
  generado vive en `apps/api/src/infrastructure/database/generated/prisma`, está **gitignored** y lo
  produce `db:generate` (que también corre `postinstall`).
- Extensiones (`pg_trgm`) y `CHECK` constraints **no se modelan en el schema**: llegan por
  migraciones editadas a mano (ver §3.2).
- Comandos: `db:generate` · `db:migrate` (desarrollo local) · `db:deploy` (CI/producción) ·
  `db:status` · `db:studio`.
- **Producción:** las migraciones corren en el pipeline (`db:deploy`), **nunca** en el runtime de la
  función.
- **`prisma migrate reset` nunca es la respuesta** sobre la base compartida de Supabase: la vacía y
  la recrea.
- `prisma migrate diff --from-migrations` requiere además `datasource.shadowDatabaseUrl` en
  `prisma.config.ts` (el flag `--shadow-database-url` fue **removido** en Prisma 7).

---

## 4. Arquitectura y despliegue

| Aspecto | Decisión |
|---------|----------|
| Repositorio | Monorepo gestionado con **Turborepo** |
| CI/CD | **GitHub Actions** |
| Frontend | Arquitectura **Vertical Slice** |
| Backend | Arquitectura **Clean Architecture** |
| Hosting | **Vercel** |
| Contenedores | **Sin uso de contenedores** |

### 4.1 Estructura esperada del monorepo

```
inventory-manager/
├── apps/
│   ├── web/            # Next.js (SPA) — Vertical Slice
│   └── api/            # Express + TypeScript — Clean Architecture
│       ├── src/
│       │   ├── domain/         # entidades y reglas de negocio
│       │   ├── application/    # casos de uso
│       │   ├── infrastructure/ # prisma, cloudinary, auth0 (validación JWT)
│       │   └── interfaces/     # controladores HTTP, rutas, validación
│       └── prisma/
├── biome.json
├── turbo.json
└── .github/workflows/
```

**Nota:** las aplicaciones son **independientes y no comparten código**: cada una tiene sus
propias dependencias, su configuración y su despliegue. Turborepo se usa para orquestar tareas
y cachear resultados, no para compartir módulos. Los esquemas **Valibot** viven dentro de cada
app; para no duplicar las reglas, el contrato entre ambas es la **especificación OpenAPI** que
produce el backend (ver 6.2).

### 4.2 Pipeline de CI (GitHub Actions)

Tareas mínimas por Pull Request:

1. `biome ci` (lint + formato)
2. `tsc --noEmit` (typecheck)
3. `jest` (unitarios, web y api)
4. `supertest` (integración de endpoints)
5. `prisma migrate deploy` contra una base efímera
6. `cypress run` (E2E) — puede correr solo en la rama principal para acotar costo

---

## 5. Observaciones técnicas

### 5.1 Nombres confirmados

| Escrito originalmente | Decisión |
|-----------------------|----------|
| «Perseo de cookies» | **cookie-parser** (nombre del paquete de Express) |
| «http-status-code» | **http-status-codes** (el paquete de npm va en plural) |
| «Chartcn» | **Recharts** — no correspondía a una librería conocida |
| «Intregation test» | **integration test** (typo) |
| Cypress como test de integración de backend | **supertest** — Cypress queda como E2E de la SPA |

### 5.2 Riesgos por correr Express en Vercel sin contenedores

Vercel ejecuta el backend como **funciones serverless** (sin estado, efímeras, con límite de
payload y de tiempo). Eso tensiona varias librerías elegidas:

| Librería | Comportamiento en serverless | Acción sugerida |
|----------|------------------------------|-----------------|
| `express-rate-limit` | El store en memoria no es global: cada instancia lleva su propio contador, así que el límite real es «N × instancias» | Store compartido (Vercel KV / Upstash Redis) — **pendiente, ver 6.2** |
| `morgan` | Escribe a stdout, que no se conserva | Integrar un colector (Vercel Log Drains, Axiom, Datadog) |
| Timeout de función | ~10 s en planes bajos | Evitar operaciones largas en el request (reportes, exportaciones) |

> `multer` ya no aplica: la subida de imágenes es directa del cliente a Cloudinary, lo que además
> esquiva el límite de payload (~4,5 MB) y el filesystem efímero.

### 5.3 Prisma + Supabase en serverless

Cada instancia de función abre sus propias conexiones y puede **agotar el pool** de Postgres. La
solución ya está **decidida y construida**:

- El **cliente de runtime** va por el driver adapter **`@prisma/adapter-pg`** con la **URL pooled**
  (pooler de Supabase, puerto 6543, `?pgbouncer=true`). El adapter es el dueño de la conexión, así
  que **no queda ningún workaround de `pgbouncer` del lado del cliente**.
- El **CLI y las migraciones** usan la **URL directa** (session pooler, puerto 5432), configurada en
  `prisma.config.ts` desde `DIRECT_URL`.

Las **migraciones no corren en el runtime** de la función: van en el pipeline de CI (`db:deploy`).

### 5.4 Autenticación con Auth0

**Decisión confirmada:** **Auth0** como proveedor de identidad (OIDC / OAuth 2.0). No se usa
Supabase Auth ni autenticación propia.

Qué implica en el código:

- El **backend no emite ni firma tokens: los valida y media el intercambio.** La **validación** va
  contra el **JWKS** de Auth0 con `express-oauth2-jwt-bearer`; la **mediación** de credenciales es
  el grant *Resource Owner Password*, servidor a servidor (ver más abajo). No se usa
  `jwks-rsa` + `jsonwebtoken`.
- **`bcrypt` deja de ser necesario**: no hay tabla de credenciales ni hashing propio.
- **`jsonwebtoken` no se usa**: la validación la hace `express-oauth2-jwt-bearer`, no un JWT
  firmado en local.
- **La aplicación de Auth0 es una Regular Web Application** (confidencial, con `client_secret`, y
  con el grant `Password` habilitado), **no una SPA**: el frontend no habla con Auth0.
- **`cookie-parser` y el almacenamiento del token** son decisiones de **MI-52/MI-54** (login y
  logout), no de esta plomería.
- **AUTH-04 (recuperación de contraseña), MFA y login social salen del alcance de desarrollo**:
  los provee Auth0.
- **Tabla `users` local:** el vínculo con Auth0 es el claim `sub`. Guardar `auth0_sub UNIQUE` y
  **no** almacenar contraseñas.
- **Frontend: sin SDK de Auth0 y sin variables `NEXT_PUBLIC_AUTH0_*`.** Con ROPG el SPA envía las
  credenciales a nuestra API; no hay `@auth0/auth0-react`, sesión ni refresh en el cliente.

**Ya cableado (2026-10-06).** `createRequireAuth({ issuerBaseURL, audience })` (en
`middlewares/require-auth.ts`) valida el JWT contra el JWKS del tenant; `main.ts` lo construye desde
`AUTH0_DOMAIN`/`AUTH0_AUDIENCE` (y falla rápido si faltan); `router.use("/companies", requireAuth)`
protege las rutas de empresas y deja `/health` público. El 401 lleva el challenge
`WWW-Authenticate` (RFC 6750), reenviado por una allowlist explícita en `error-handler.ts`.

Dos consecuencias a tener presentes:

1. **El aislamiento por empresa sigue siendo responsabilidad de la aplicación** (no se usa RLS de
   Supabase). Auth0 autentica *quién* es el usuario, no *a qué empresa* puede acceder: la
   autorización por empresa es código propio.
2. **Costo y dependencia externa:** Auth0 cobra por usuario activo mensual, y es un proveedor
   crítico en el camino de login.

**Decidido (2026-10-06): formulario propio mediado por el backend.** La vista de Login/Registro del
diseño se implementa tal cual: el SPA envía las credenciales a **nuestra API**, y la API las
intercambia con Auth0 **servidor a servidor** usando el *Resource Owner Password* grant.

**Por qué se descartaron las otras dos vías:**

- **Universal Login (redirect)**: la UI es de Auth0 y la vista de MI-19 no se usaría. Además, en el
  plan Free `Customize Signup & Login` **no está disponible**, así que no se puede reconstruir la
  página hospedada para que se parezca al diseño.
- **Embedded login en el navegador** (el SPA llamando a Auth0 directamente): **requiere un custom
  domain**. Sin él la autenticación cross-origin depende de cookies de terceros, que Firefox, Safari
  y Chromium **bloquean por defecto** — el login fallaría en producción. Y en el plan Free el custom
  domain exige verificación de tarjeta.

**Consecuencias que hay que asumir. Ninguna es opcional:**

1. **Rate limiting propio en el endpoint de login.** La documentación de Auth0 advierte que con ROPG
   *"some attack protection features may fail"*. La protección anti-abuso de Auth0 deja de alcanzar y
   hay que poner la propia. Depende del store compartido de **MI-38**, porque el backend corre en
   Vercel serverless y el contador en memoria no limita globalmente.
2. **La contraseña transita nuestra función serverless.** Hay que garantizar que nunca se registre en
   logs (`morgan` no loguea bodies por defecto: lo importante es **no** agregar un logger que sí lo
   haga) y que viaje sólo por TLS.
3. **Errores uniformes.** El login no debe revelar si el email existe o no.
4. **Sin login social y sin MFA listo.** ROPG no soporta IdP sociales, y MFA requiere el flujo
   API-driven. AUTH-04 (recuperación de contraseña) sigue siendo de Auth0.
5. **Auth0 desaconseja el ROPG** (*"Though we do not recommend it"*) y lo permite sólo para
   aplicaciones de primera parte *"absolutely trusted"*. Este es ese caso, pero conviene tenerlo
   presente como **deuda de seguridad consciente**, no como un descuido.

**Alternativa que Auth0 soporta y no usamos:** embedded login con **Passwordless** o **Passkeys** para
SPAs. Evita la contraseña y el problema de las cookies, pero cambia el diseño (MI-19 tiene campo de
contraseña) y contradice AUTH-01.

> El acceso de **varias personas a una misma empresa** (membresías, roles y asignación) se especifica
> en [§5.8](#58-acceso-multi-usuario-por-empresa-membresías-y-roles). Auth0 autentica *quién* es el
> usuario; *a qué empresa* puede acceder es código propio, y ahí está la decisión de fondo.

### 5.5 Pruebas: alcance confirmado

| Nivel | Herramienta | Qué prueba |
|-------|-------------|------------|
| Unitario | **Jest** | Lógica pura: casos de uso, utilidades, validadores |
| Integración frontend | **React Testing Library** | Componentes y slices contra la API mockeada |
| Integración backend | **supertest** | Endpoints HTTP contra la app Express real |
| E2E | **Cypress** | Flujos completos en el navegador contra el stack levantado |

**Confirmado:** la integración de backend se hace con **supertest**, no con Cypress. Cypress queda
únicamente como E2E de la SPA.

**Nuevo punto de atención con Auth0:** los endpoints protegidos ya no se pueden testear con un token
firmado localmente. Hay que definir cómo se inyecta un token válido en los tests de `supertest`
(firmar con una clave de prueba en el entorno de test, o *stubear* el middleware de validación) —
ver 6.2.

### 5.6 Monorepo sin contenedores

Al no usar contenedores, el entorno local depende de servicios en la nube (Supabase, Cloudinary,
Auth0). Implicancias: no hay paridad local exacta de la base, los tests de integración necesitan una
base efímera (rama de Supabase o Postgres instalado localmente sin Docker), y el onboarding requiere
acceso a las credenciales de esos servicios desde el día uno.

### 5.7 Herramientas compartidas

**Biome** (lint + formato), **Jest**, **TypeScript** y **Valibot** aparecen en ambos lados. Al no
haber código compartido, cada app lleva su propia configuración: **Biome** se configura una vez en
el `biome.json` de la raíz (para que el formato y las reglas sean consistentes en todo el repo) y
cada app mantiene su `tsconfig.json` de forma independiente.

### 5.8 Acceso multi-usuario por empresa (membresías y roles)

**El problema.** EMP-02 dice "un usuario puede crear y administrar múltiples empresas": esa es la
dirección *usuario → empresa*. Falta la dirección inversa, **varias personas accediendo a la misma
empresa**. Sin modelarla, el esquema asume en silencio que el creador de la empresa es su único
usuario — que es lo que hacía `Company.owner_user_id`.

**La distinción de fondo: identidad y pertenencia son cosas distintas.**

- **Identidad** — quién es la persona. La custodia **Auth0**. Cada usuario tiene su propia cuenta.
  El administrador de una empresa **nunca** crea cuentas ni conoce contraseñas ajenas.
- **Pertenencia** — a qué empresas puede acceder y con qué rol. Vive en **Postgres** y es código
  propio, coherente con §5.4.

Un administrador **autoriza una identidad existente** a su empresa. Esa es toda la operación, y es lo
que evita las credenciales compartidas (que además harían inútil la auditoría de MOV-05).

#### Por qué no Auth0 Organizations

Organizations resuelve esto, pero en el **plan Free** (verificado en `auth0.com/pricing`):

| | Free | B2B Essentials |
| --- | --- | --- |
| Precio | $0/mes | $150/mes |
| Organizations | **5** | ilimitadas |
| Role Management | **no disponible** | incluido |
| Email Workflow | **no disponible** | incluido |
| Customize Signup & Login | **no disponible** | incluido |

1. **5 organizaciones** es un techo que rompe EMP-01 a EMP-05, que giran alrededor de las empresas.
2. **Role Management no está en Free**: los roles vivirían en Postgres igual. No ahorra la autorización.
3. **Email Workflow no está en Free**: el email de aviso habría que mandarlo con un proveedor propio igual.
4. Con Organizations el rol viaja **en el token**, y el token **sobrevive a la revocación**: le quitás
   el acceso a alguien y sigue operando hasta que expire.

#### Registro vs. invitación

Son dos preguntas distintas y conviene no mezclarlas:

- **Registro** — cómo se crea una cuenta.
- **Invitación** — cómo se suma alguien a la empresa de otro.

**Decisión: registro abierto + pertenencia por asignación.** Cualquiera crea su cuenta; para entrar a
la empresa de otro hace falta que un OWNER o ADMIN te asigne.

Esto **elimina los tokens de invitación y el envío de emails**, porque **la dirección de email es la
llave de unión**: el admin asigna un email y, cuando esa persona se registra con él, el sistema
matchea la asignación pendiente. Sin token, sin expiración, sin proveedor de email.

#### Modelo de datos

```prisma
enum MembershipRole {
  OWNER
  ADMIN
  MEMBER
}

enum MembershipStatus {
  INVITED
  ACTIVE
  REVOKED
}

model User {
  id        String   @id @default(uuid())
  auth0Sub  String   @unique @map("auth0_sub")
  email     String   @unique
  fullName  String?  @map("full_name")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  memberships   Membership[]
  invitedOthers Membership[] @relation("InvitedBy")

  @@map("users")
}

model Membership {
  id           String           @id @default(uuid())
  userId       String?          @map("user_id")
  invitedEmail String           @map("invited_email")
  companyId    String           @map("company_id")
  role         MembershipRole
  status       MembershipStatus @default(INVITED)
  invitedBy    String           @map("invited_by")
  acceptedAt   DateTime?        @map("accepted_at")
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  user    User?   @relation(fields: [userId], references: [id])
  company Company @relation(fields: [companyId], references: [id])
  inviter User    @relation("InvitedBy", fields: [invitedBy], references: [id])

  @@unique([userId, companyId])
  @@index([invitedEmail, status])
  @@map("memberships")
}
```

Tres cosas del modelo que son decisiones, no detalles:

- **`userId` es nullable a propósito**: la asignación existe antes que la cuenta. Si fuera obligatorio
  habría que crear la membership recién cuando la persona acepta, y se perdería la asignación pendiente.
- **`@@unique([userId, companyId])`** habilita varias empresas por usuario (EMP-02) sin permitir duplicados.
- **`Company.owner_user_id` desaparece**: el dueño es la membership con `role = OWNER`. Un campo
  `owner_user_id` no tiene lugar para roles ni para más de un usuario.

Revocar es `status = REVOKED`, **nunca** `DELETE`: los movimientos históricos siguen apuntando al
usuario y tienen que seguir siendo legibles (MOV-05).

#### Cómo se otorga el acceso

| Acción | Quién puede |
| --- | --- |
| Asignar a alguien a una empresa | ADMIN u OWNER **de esa empresa** |
| Asignar o quitar `MEMBER` | ADMIN u OWNER de esa empresa |
| Asignar o quitar `ADMIN` | **OWNER** de esa empresa |
| Asignar o quitar `OWNER` | **OWNER** de esa empresa |
| **Cambiar el propio rol** | **nadie** |
| Salir de una empresa | cualquiera, **si no es el último OWNER activo** |
| Crear empresa | cualquier usuario autenticado (bootstrap) |
| Ver usuarios | sólo los de **sus** empresas |

#### Los cuatro flujos

1. **Primer usuario (bootstrap).** Se registra → crea su empresa → membership `OWNER` `ACTIVE`. Sin
   esto no puede existir ninguna empresa nunca.
2. **Asignación a alguien que ya tiene cuenta.** El admin lo asigna (`INVITED`) → al iniciar sesión ve
   la asignación pendiente → acepta → `ACTIVE`.
3. **Asignación a alguien que no tiene cuenta.** El admin lo asigna y le avisa por fuera → la persona
   se registra con ese email → el sistema matchea la asignación pendiente → acepta → `ACTIVE`.
4. **Usuario sin asignación.** Se registra, queda **sin ninguna empresa**, y la app le ofrece crear la
   suya o esperar. Es un estado nuevo: el mockup del dashboard asume una empresa ya seleccionada.

#### Invariantes de seguridad

1. **El `company_id` nunca se confía al cliente.** En cada request el servidor resuelve
   `auth0_sub → user_id` y **valida la membership** de esa empresa. Un `company_id` no autorizado es
   `403`, no datos. Es la materialización concreta de lo que §3.1 llama el mayor riesgo del proyecto:
   la validación tiene que estar en **cada** endpoint, no sólo en el switch de empresa.
2. **`email_verified` es obligatorio.** En este modelo el email es la llave de unión: sin verificarlo,
   cualquiera se registra con el email de otra persona y reclama su asignación.
3. **Nadie cambia su propio rol**, ni siquiera un OWNER. Es lo que mata la auto-escalada.
4. **Toda empresa conserva al menos un OWNER activo**, para no dejarla huérfana.
5. **No hay búsqueda global de usuarios.** Un buscador de usuarios registrados filtra quién tiene
   cuenta (fuga entre empresas). El admin escribe el email y la respuesta es la misma exista o no.

#### Casos borde

- **Cambio de email.** El match es por email, así que una asignación pendiente con el email viejo
  queda huérfana. Una vez que la membership tiene `user_id`, se deja de matchear por email, y las
  memberships ya aceptadas no se ven afectadas.
- **Mismo email, dos proveedores.** En Auth0 el `sub` es único por identidad: la misma persona entrando
  con Google y con email/contraseña son **dos `sub`**. Hay que activar *account linking* en Auth0, o
  mantener `email` único en `users` y tratar el segundo `sub` como candidato a vincular.

#### Fuera de alcance por ahora: el super-admin de plataforma

Se evaluó y **se descarta por ahora**. El acceso a la base de datos ya cumple esa función y es más
fuerte: requiere acceso a infraestructura, no una sesión. Un rol que existe en el dominio pero es
inalcanzable no es un control, es deuda con riesgo — cada rama de código que lo chequee es una
escalada de privilegios esperando un bug. Si algún día hace falta, va como **atributo global del
usuario** (`users.is_platform_admin` o tabla aparte) y **nunca** como un valor de `MembershipRole`:
una membership está acotada a una empresa, un privilegio de plataforma no.

---

## 6. Pendientes y su resolución

Los 9 pendientes quedaron resueltos. Efecto de cada decisión sobre el stack:

| Pendiente | Decisión | Efecto |
|-----------|----------|--------|
| Librería de gráficos | **Recharts** | Reemplaza a «Chartcn» en el frontend |
| Test de integración de backend | **supertest** | Cypress queda solo como E2E de la SPA |
| Autenticación | **Auth0** | Desplaza a `bcrypt` y `jsonwebtoken`; ver 5.4 |
| Store de rate limit | **sin definir** → ver 6.2 | El backend va a Vercel, así que el store en memoria no limita globalmente |
| Subida de imágenes | **Directa a Cloudinary** desde el cliente | `multer` deja de ser necesario |
| Prisma y bcrypt en Vercel | No requieren configuración especial en runtime | Sin cambios (y con Auth0, `bcrypt` puede no usarse) |
| Supabase Storage vs. Cloudinary | **Cloudinary**; Storage se descarta | No usar ambos |
| Versión de PostgreSQL | Última estable soportada por Supabase | Fijar la *major* en 3.1 al aprovisionar |
| Tipo de PK | **`uuid`** | Sin cambios |

### 6.1 Resolución de pendientes

- Libreria de graficos: Recharts
- Test de intregracion de backend: Supertest
- Auth: Auth0
- Store compartido de rate limit: backend va a Vercel
- Subida de imagenes: Directa a Cloudinary
- Verficación de configuración prisma y bcrypt: No necesitan una configuración especial en runtime en vercel
- Confirmación queda descartada: Supabase Storage queda descartado en favor de Cloudinary
- Versión de PostgreSQL: Ultima
- Confirmacion de uso uuid: confirmado

### 6.2 Pendientes abiertos

Las configuraciones que salen de aquí son **subtareas de [MI-2](https://alexbuelvas92.atlassian.net/browse/MI-2)** (Fase 1 · Setup del proyecto);
se indica la clave en cada punto.

- [ ] **Store compartido del rate limit** (**MI-38**). El backend va a Vercel, así que el contador en memoria no
      limita globalmente. Recomendado **Vercel KV** o **Upstash Redis** (ya integrable con Vercel).
- [x] **UX de autenticación con Auth0** (**MI-39**): **resuelto** — formulario propio mediado por el backend
      (ROPG). Ver §5.4. Efecto: las pantallas de Login/Registro del diseño se implementan tal cual, y
      el rate limiting del login pasa a ser obligatorio.
- [x] **Cómo se testean los endpoints protegidos** con `supertest` (**MI-39**): **resuelta** — clave
      de prueba + JWKS local. Se descartó el stub porque un `issuer`/`audience` mal configurado
      pasaría la suite en verde sin ejercitar nunca esa configuración.
- [x] **Extensión `pg_trgm`** para búsqueda difusa de productos y clientes: **sí** (**MI-38**).
      Activada en la primera migración (`20261006223356_init`); disponible (1.6) e instalada.
- [x] **Limpieza del `package.json` del backend** (sin subtarea propia): **confirmado** — `bcrypt`,
      `jsonwebtoken` y `multer` no están en `apps/api/package.json`.
- [x] **Versión *major* de PostgreSQL** (**MI-38**): **17**, medido en el proyecto aprovisionado
      (el servidor reporta 17.6). «Última estable soportada por Supabase» resultó ser 17.
- [ ] **Contrato entre frontend y backend** (**MI-43**). Al no haber código compartido, hay que decidir cómo se
      evita duplicar las reglas de validación. Recomendado: **generar los tipos del frontend desde
      la especificación OpenAPI** que el backend ya produce con `swagger + yamljs`.

> Ya resueltos en el setup (no son pendientes): estructura de carpetas, lint/formato con Biome,
> entorno de desarrollo local, comandos documentados en el README, base de la API con Clean
> Architecture y el design system con modo oscuro aplicados. Ver las subtareas en `Done` de MI-2.

---

## 7. Trazabilidad con el diseño

El design system ya entrega en `design/inventory-manager.fig` los **tokens con dos modos**
(claro y oscuro) y los componentes base. Con el stack definido, el siguiente paso es extraer
esos tokens a la configuración de **Tailwind CSS** y generar los componentes **shadcn/ui**.

| Entregable de diseño | Destino en el código |
|----------------------|----------------------|
| Tokens (colores, radios, espaciado) | `apps/web/app/globals.css` → variables de Tailwind |
| Componentes base (botón, badge, input, tabla) | `apps/web/components/ui` → shadcn/ui |
| Modo claro / oscuro | Estrategia de tema de Tailwind + `next-themes` |
| Pantallas de Login / Registro | Flujo de Auth0 (ver 5.4 y 6.2) |
| Base de datos | `schema.prisma` + cadena de conexión vía pooler |
| Gráficos del dashboard | **Recharts** (`Stock por categoría`, `Distribución del valor`) |
