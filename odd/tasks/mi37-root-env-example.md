# MI-37 — `.env.example` de la raíz

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-37 (`To Do`)
**Es un bloqueante absoluto**: `docs/plan-de-trabajo.md:45-46` — *"Sin esto no hay onboarding reproducible
ni CI que arranque"*.

## Objetivo

Un `.env.example` en la **raíz** del monorepo que liste todas las variables que el proyecto lee, con
placeholders y sin secretos, para que un clon nuevo se pueda levantar sin adivinar.

## Contexto medido

| Pieza | Estado |
|---|---|
| `apps/api/.env.example` | ✅ Existe |
| `apps/web/.env.example` | ✅ Existe |
| **`.env.example` raíz** | ❌ **No existe** (`README.md:417`: "El de `apps/api` ya existe; falta el del monorepo y el del frontend") |
| `.gitignore` | ✅ `.env*` ignorado **con `!.env.example`** (`:15-17`) → un `.env.example` en la raíz **sí** se versiona |
| Variables que el código **lee de verdad** | `apps/api/src/config/env.ts:152-173`: `PORT` (default 3001), `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `WEB_ORIGIN`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_CONNECTION` (las marcadas `SECRET_VARIABLES` en `:41-45`) · `apps/api/prisma.config.ts:24`: `DIRECT_URL` · `apps/web/lib/api/client.ts:155`: `NEXT_PUBLIC_API_URL` |
| `CLOUDINARY_*` | ⚠️ **Nadie las lee todavía** — llegan con MI-40, que es la tarea siguiente |

**Mínimo documentado** (`README.md:381-402`): `DATABASE_URL` (pooler 6543 con `?pgbouncer=true`),
`DIRECT_URL` (5432), `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
`AUTH0_CONNECTION`, `WEB_ORIGIN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`NEXT_PUBLIC_API_URL`.

## Decisiones de diseño

1. **Un solo archivo, agrupado por consumidor** (API, web, base de datos, Auth0, Cloudinary), cada variable
   con **una línea de para qué sirve** y de dónde sale el valor. Es documentación de onboarding, no una
   lista pelada.
2. **Placeholders, nunca valores reales.** Los secretos van con un marcador explícito
   (`<de-Auth0>`, `<de-Cloudinary>`), y el archivo dice en una línea que los secretos **sólo** viven en
   variables de entorno locales o del deploy — nunca en el repo.
3. **`CLOUDINARY_*` se incluye aunque todavía no se lea**: está en el mínimo documentado y MI-40 es la
   tarea siguiente. Se anota que hoy nadie las consume, para que nadie crea que ya funcionan.
4. **Los dos `.env.example` de `apps/` se quedan**: el de la raíz es la vista del monorepo, no un
   reemplazo. Se agrega un puntero desde el `README` si hace falta.
5. **El archivo no se convierte en un `.env`**: no se crea ningún `.env`/`.env.local` (y no se commitea
   ninguno si el usuario tiene uno local).

## Unidades de trabajo

- **U1 — El archivo + su puntero en el README.** Es un artefacto de documentación: ~40-60 líneas.

## Fuera de alcance

Crear `.env` o `.env.local` reales · mover o reescribir los `.env.example` de `apps/` · validación de
entorno nueva (ya existe `loadEnv()` en la API) · secretos de deploy.

## Ruta y presupuesto

Delegada o inline. **Verificación**: que cada variable listada sea una que el código lee de verdad
(`grep process.env`), y que ninguna contenga un valor real. Sin test automatizable — es documentación; la
verificación es estructural.
