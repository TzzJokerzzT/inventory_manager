# Feature: Cerrar los pendientes bloqueantes del stack

**Estado:** en progreso
**Origen:** los 3 pendientes bloqueantes de [`README.md`](../../README.md#pendientes) y [`docs/stack.md`](../../docs/stack.md)
**Orden de ejecución:** 3 → 2 → 1 (primero lo mecánico, después lo acotado, al final lo grande)

## Contexto

> Estado de partida, ya resuelto por T1–T3. Ver «Evidencia» y «Traslado a Jira (MI-2)».

El repositorio es un monorepo Turborepo con **dos aplicaciones independientes** (`apps/web` y
`apps/api`), sin `packages/` ni código compartido. Hoy:

- `apps/web` compila (typecheck limpio) con Tailwind v4 + shadcn/ui inicializados.
- `apps/api` es una **carpeta vacía**.
- El tooling quedó a medias: Biome instalado, pero ESLint/Prettier todavía presentes.
- El tema es el neutro por defecto de shadcn: **ningún token del design system está aplicado**.

## Alcance

- ✅ **Dentro:** el tooling de lint/formato, los tokens del design system con modo claro/oscuro, y la
  creación de `apps/api` con su estructura de Clean Architecture y un endpoint de salud.
- ❌ **Fuera:** Prisma y migraciones, Auth0, Cloudinary, tests, CI, `git init` y el contrato OpenAPI.
  Son pendientes propios y se abordan por separado.

---

## T1 — Migrar el tooling a Biome (pendiente 3)

- [x] **T1.1** `biome.json`: agregar el soporte de directivas de Tailwind (`@custom-variant`,
      `@theme`, `@apply`) y excluir los assets de `public/` del lint de a11y.
- [x] **T1.2** Scripts de la raíz: `format` → Biome (hoy invoca Prettier, que no está instalado),
      `lint` → Biome, y agregar un `format:check` para el CI.
- [x] **T1.3** `apps/web`: quitar `eslint` de las dependencias y corregir el script `lint`
      (`"biome chech"` → `"biome check"`).
- [x] **T1.4** Correr el formateo y dejar `biome check` en verde. Estado de partida: **23 errores**.

## T2 — Tokens del design system y modo oscuro (pendiente 2)

- [x] **T2.1** Escribir los **38 tokens** (19 claros + 19 oscuros) en
      `apps/web/app/globals.css`, mapeando los que corresponden a las variables que shadcn/ui ya
      espera (`--background`, `--foreground`, `--primary`, `--border`, `--muted`, `--destructive`,
      `--ring`…) y agregando las que son propias del design system (`--success`, `--warning`,
      `--info` y sus variantes `-soft`, `--surface`, `--text-secondary`…).
- [x] **T2.2** Exponer los tokens al tema de Tailwind (`@theme inline`) para poder usar clases como
      `bg-surface`, `text-success` o `border-default`.
- [x] **T2.3** Corregir la escala de radios: `--radius-lg` debe ser **12px** (hoy es 10px). Los
      valores `sm` (6px) y `md` (8px) ya coinciden.
- [x] **T2.4** Agregar la escala de espaciado (4/8/12/16/24/32) como tokens documentados.
- [x] **T2.5** Instalar `next-themes`, crear el `ThemeProvider` y un toggle de tema, y montarlos en
      `app/layout.tsx`. Hoy el bloque `.dark` existe pero **nada lo activa**.
- [x] **T2.6** Verificar: typecheck limpio, `biome check` en verde y los 38 valores correctos.

## T3 — `apps/api` con Clean Architecture (pendiente 1)

- [x] **T3.1** `apps/api/package.json` (nombre, scripts `dev`/`build`/`start`/`lint`/`check-types`) y
      `tsconfig.json` independiente, sin extender configs de paquetes inexistentes.
- [x] **T3.2** Instalar las dependencias del backend decididas: `express`, `cors`, `helmet`,
      `cookie-parser`, `morgan`, `express-rate-limit`, `express-oauth2-jwt-bearer`,
      `express-validator`, `valibot`, `dotenv`, `http-status-codes`, y como dev `typescript`,
      `@types/*`, `biome`, `supertest`, `jest`. *(Prisma y cloudinary se configuran en su propio
      pendiente, pero se declaran si no arrastran configuración.)*
- [x] **T3.3** Crear las capas de Clean Architecture con contenido real (no carpetas vacías):
      `domain/` (entidad de ejemplo + interfaz de repositorio), `application/` (un caso de uso),
      `infrastructure/` (implementación en memoria del puerto), `interfaces/http/` (controlador,
      rutas, middlewares de error y 404).
- [x] **T3.4** Entry point separado de la app de Express: un `app.ts` que exporte la app (para que
      `supertest` la pueda importar sin abrir un puerto) y un `main.ts` que haga `listen`.
- [x] **T3.5** Endpoint de salud (`GET /health`) y verificación: typecheck, arranque real del
      servidor y un smoke test con `supertest`.

---

## Evidencia

### T1 — Migración a Biome ✅

- `biome.json`: `css.parser.tailwindDirectives: true` y `files.includes: ["**", "!apps/web/public"]`
  (así los SVG de `public/` dejan de lintearse sin desactivar la regla de a11y globalmente).
- Raíz: `lint` → `biome check .`, `format` → `biome format --write .`, nuevo `format:check`.
- `turbo.json`: removida la tarea `lint`, que quedó sin consumidores.
- `apps/web`: removados `eslint` de devDependencies y el script `lint` roto (`"biome chech"`).
- Formateo aplicado en `globals.css`, `layout.tsx`, `components/ui/button.tsx`, `lib/utils.ts`,
  `postcss.config.mjs` y `components.json` — **solo formato**, sin cambios de valores ni de
  comportamiento (verificado: `globals.css` conserva sus 62 valores `oklch`).
- **`bunx biome check .` → exit 0** (`Checked 13 files. No fixes applied.`). Antes: exit 1.
- `bun install` re-sincronizó `bun.lock`; 0 referencias a `eslint` en los `package.json`.
- Nota de medición: el writer midió **19** errores de base, no los 23 reportados antes. El repo
  cambió entre ambas mediciones (`page.module.css`, `tsconfig.json` y `page.tsx` ya no aparecían).

### T2 — Tokens del design system y modo oscuro ✅

- Los **38 valores** (19 claros + 19 oscuros) están en `apps/web/app/globals.css`, sobreescribiendo
  las variables de shadcn/ui (una sola paleta: los componentes de shadcn heredan el design system)
  y agregando los tokens propios del sistema (`--success`, `--warning`, `--info`, `--surface`,
  `--text-secondary`…). Se eliminó la paleta gris `oklch(… 0 0)`: **0 ocurrencias de `oklch`**.
- **Radios exactos:** `--radius-sm: 0.375rem` (6px), `--radius-md: 0.5rem` (8px),
  `--radius-lg: 0.75rem` (12px). Antes `lg` calculaba 10px.
- **Espaciado:** no se declaró una escala nueva. Tailwind v4 ya trae `--spacing: 0.25rem`, así que
  `p-1…p-8` (4/8/12/16/24/32 px) ya coinciden exactamente con el design system. Se documentó con un
  comentario en vez de duplicar los tokens, y se comprobó con el CSS emitido.
- **Modo oscuro activo:** `next-themes@0.4.6` + `components/theme-provider.tsx` +
  `components/theme-toggle.tsx`, montados en `app/layout.tsx` con `attribute="class"`,
  `defaultTheme="system"`, `enableSystem` y `suppressHydrationWarning` en `<html>`. Se eliminó el
  bloque `prefers-color-scheme` del starter, que competía con la estrategia por clase.
- **Verificado:** los 38 hex presentes, `bunx tsc --noEmit` → exit 0, `bunx biome check .` → exit 0
  (`Checked 15 files. No fixes applied.`).
- Decisiones que tomó el writer y conviene revisar: los `--sidebar-accent`/`--sidebar-border` (el
  design system no define tokens de sidebar) se resolvieron con `surface-muted`/`border` en modo
  oscuro para mantener contraste claro-sobre-oscuro en **ambos** modos; y los `--chart-1..5` de
  shadcn (sin equivalente en el design system) se aliasearon a primary/info/success/warning/danger.
- Efecto colateral aceptado: `--radius-md` pasó de 10px a 8px, así que los tamaños `xs`/`sm`/`icon-*`
  de `components/ui/button.tsx` cambian de 10px a 8px. El componente no se modificó.

### T3 — `apps/api` con Clean Architecture ✅

- **22 archivos** creados. Capas con contenido real (no carpetas vacías): `domain/` (entidad
  `Company` con factory que valida, `DomainError`, y el **puerto** `CompanyRepository` como
  interfaz), `application/` (casos de uso `CreateCompany` y `ListCompanies`), `infrastructure/`
  (`InMemoryCompanyRepository` implementando el puerto) e `interfaces/http/` (`app.ts`,
  controladores, rutas, middlewares de error/404/rate-limit y validador con **valibot**).
- **Regla de dependencia respetada:** `src/domain` y `src/application` **no importan** `express`,
  `dotenv`, `supertest` ni nada de infraestructura — verificado con grep (0 coincidencias).
- **`app.ts` exporta `buildApp(deps)` sin `listen`** (para que `supertest` la importe sin abrir
  puerto) y **`main.ts` es el composition root** que inyecta el repositorio en los casos de uso y
  recién ahí hace `listen`.
- **ESM + `tsc` verificado de punta a punta:** `tsc -p tsconfig.json` emite a `dist/`, y
  `node dist/main.js` sirvió `GET /health` con **HTTP 200** (`{"status":"ok",…}`), con headers de
  helmet y CORS. `bun src/main.ts` también sirve 200 (Bun resuelve los especificadores `.js` a `.ts`).
- **Tests:** `bun test` → **4 pass / 0 fail** (health 200, alta y listado, nombre vacío → 400,
  ruta desconocida → 404) con `supertest` contra `buildApp`, sin abrir listener.
  *Nota:* se usó el runner propio de Bun porque Jest todavía no está configurado (pendiente aparte).
- **Verificado:** `bunx tsc --noEmit` → exit 0; `bunx biome check .` en la raíz → exit 0
  (`Checked 36 files`).
- Puerto por defecto **3001** (web usa 3000). Documentado en `.env.example` junto con los
  placeholders comentados de `DATABASE_URL`, `DIRECT_URL` y `AUTH0_*` (sin valores inventados).
- **Hallazgo del writer, corregido:** `.gitignore` tenía `.env*`, que también ignoraba
  `apps/api/.env.example` — un archivo que **debe** versionarse porque documenta las variables
  requeridas. Se agregaron las negaciones `!.env.example` y `!apps/*/.env.example`; verificado que
  el ejemplo ya es rastrable y que los `.env` reales siguen ignorados.
- Pendiente derivado: `express-oauth2-jwt-bearer` y `express-validator` están declarados pero sin
  cablear (Auth0 y la validación son pendientes propios); el rate limit usa el store en memoria, con
  un TODO que apunta a `docs/stack.md` § 5.2.

## Traslado a Jira (MI-2)

Al cerrar el bootstrap, las 6 configuraciones que quedaron **hechas** se registraron como subtareas
cerradas de `MI-2` — [Fase 1] Setup del proyecto — y los pendientes como subtareas abiertas:

| Estado | Configuración | Clave |
| --- | --- | --- |
| ✅ Done | Estructura de carpetas backend + frontend (Turborepo) | `MI-29` |
| ✅ Done | Linter y formateador de código (Biome) | `MI-30` |
| ✅ Done | Entorno de desarrollo local (Bun + Turborepo) | `MI-31` |
| ✅ Done | Documentar comandos de inicio en README | `MI-32` |
| ✅ Done | Base del backend con Clean Architecture + `/health` | `MI-33` |
| ✅ Done | Design system y modo oscuro en el frontend | `MI-34` |
| ⏳ To Do | Configurar control de versiones (Git) | `MI-35` |
| ⏳ To Do | Configurar CI (`.github/workflows/`) | `MI-36` |
| ⏳ To Do | Crear el `.env.example` de la raíz | `MI-37` |
| ⏳ To Do | Configurar Prisma + Supabase | `MI-38` |
| ⏳ To Do | Configurar Auth0 | `MI-39` |
| ⏳ To Do | Configurar Cloudinary | `MI-40` |
| ⏳ To Do | Configurar los tests + tarea `test` en `turbo.json` | `MI-41` |
| ⏳ To Do | Instalar Husky (git hooks) | `MI-42` |
| ⏳ To Do | Definir el contrato frontend ↔ backend (OpenAPI) | `MI-43` |

Las tareas **T1–T3 de este documento quedan cerradas**: su alcance era el tooling, los tokens del
design system y la creación de `apps/api`.

## Notas

- **No se hacen commits:** el proyecto todavía no es un repositorio git propio (vive dentro de un
  repo cuyo raíz es el home del usuario). Los work-unit commits que pide ODD quedan bloqueados hasta
  que exista `git init` en la carpeta del proyecto.
- **Git lo toma el usuario** (decisión del 2026-09-25): no se ejecutó `git init` ni se tocó
  `$HOME/.git`. Queda como subtarea abierta `MI-35`, y bloquea `MI-36` (CI) y `MI-42` (Husky).
