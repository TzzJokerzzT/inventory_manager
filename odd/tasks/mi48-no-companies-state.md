# MI-48 — Estado "sin empresas" para un usuario recién registrado

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-48 (`To Do` → al cerrar)

## Objetivo

Un usuario registrado **sin ninguna empresa** no tiene contexto, y el diseño asume una empresa ya
seleccionada. Este estado no está diseñado en el `.fig`, así que se **deriva del dashboard**.

**Criterios de MI-48 (Jira, textuales)**

1. Estado que ofrezca "crear mi empresa" (bootstrap) o esperar una asignación.
2. **No se puede entrar al dashboard sin empresa activa.**
3. **El switch de empresa no se muestra si hay una sola empresa o ninguna.**

## Decisiones del usuario (2026-10-06)

1. **Alcance completo**: capa de estado + pantalla derivada del dashboard con el design system +
   guardia + regla del switch.
2. **El estado vive en una ruta propia** (`/sin-empresas`) con una **guardia** que redirige ahí desde
   cualquier ruta que necesite empresa activa. Es lo más explícito para "no se puede entrar al
   dashboard" y lo más fácil de testear.

## Contexto medido

- **El backend ya tiene todo**: `POST /companies` crea la empresa **con su membership `OWNER` `ACTIVE`**
  (MI-44) y `GET /companies` devuelve **sólo las del usuario**. No hace falta tocar la API.
- **El dashboard, el shell de la app y el switch de empresa todavía no existen como vistas.** El mockup
  (`design/exports/02-dashboard.png`) sí: barra lateral oscura con la navegación y el usuario abajo, y
  **barra superior con el switch de empresa** (botón con punto de color + nombre + chevron), buscador e
  íconos.
- El design system tiene lo necesario para derivar la pantalla: `Alert`, `Button`, `TextField`,
  `KpiCard`, `DataTable`, `StockBadge` y los tokens de color/espaciado.
- **El usuario está trabajando en paralelo** en `components/ui/toast.tsx` y
  `src/shared/components/AlertMessage.tsx`. No se tocan.

## Diseño

### Capa de estado (el corazón de la tarea)

- `useCompanies()` — `GET /companies` con TanStack Query y **validación de frontera** con Valibot
  (`companiesResponseSchema`): un backend que cambie de forma tiene que fallar como error de datos, no
  explotar en la vista.
- `useCompanyStore()` — Zustand con la **empresa activa**. Las reglas de selección son una **lectura
  derivada**, no un efecto: si la empresa activa ya no está en la lista, se usa la primera; con cero
  empresas no hay empresa activa. Nada de `useEffect` sincronizando estado que se puede derivar.
- `useActiveCompany()` / `useCompanySwitcherVisibility()` — los dos predicados que consumen las vistas:
  la empresa activa y si corresponde mostrar el switch (**sólo con 2 o más**).

### La pantalla (`/sin-empresas`)

Derivada del dashboard: tarjeta centrada con el título, la explicación, el formulario de
**"crear mi empresa"** (nombre → `POST /companies` → refresca la lista y deja esa empresa como activa) y
la alternativa de **esperar una asignación** ("cuando alguien te asigne a una empresa, la vas a ver
acá"). Usa los componentes y tokens del design system; el pulido visual fino pertenece a la tarea de la
vista de dashboard, no acá.

### La guardia

`RequireActiveCompany` — un componente cliente que envuelve las rutas que necesitan empresa activa:

- mientras carga → un estado de carga (no un salto de ruta, para no parpadear);
- si hay error → mensaje con reintento;
- si el usuario tiene **cero** empresas → **redirige a `/sin-empresas`**;
- si tiene una o más → renderiza los hijos.

Como el dashboard todavía no existe, la guardia se entrega **lista para envolverlo**, y `/sin-empresas`
hace lo inverso: si el usuario **sí** tiene empresas, redirige a `/` (el dashboard llega con la vista de
MI-20). Queda documentado para que no se lea como un agujero.

## Tareas

- [ ] **T1 — Capa de estado.** `useCompanies` + esquema de frontera + store de empresa activa + los dos
  predicados, con tests de las tres reglas (cero, una, dos o más).
  Superficies: `apps/web/lib/api/schemas.ts`, `apps/web/src/features/company/api/**`,
  `apps/web/src/features/company/store/**`.
- [ ] **T2 — Switch de empresa.** Componente que **no se renderiza** con 0 o 1 empresa y con 2+ muestra
  el trigger del mockup y permite cambiar la activa.
  Superficies: `apps/web/src/features/company/components/company-switcher.tsx`.
- [ ] **T3 — Pantalla y ruta.** `/sin-empresas` con el formulario de creación y la alternativa de
  esperar asignación. Superficies: `apps/web/app/sin-empresas/**`,
  `apps/web/src/features/company/components/no-companies-state.tsx`.
- [ ] **T4 — Guardia.** `RequireActiveCompany` con sus cuatro estados.
  Superficies: `apps/web/src/features/company/components/require-active-company.tsx`.
- [ ] **T5 — Tests.** Reglas de selección, visibilidad del switch, creación de empresa (éxito y error),
  y la guardia redirigiendo con cero empresas y renderizando con una.
- [ ] **T6 — Documentación y Jira.** `docs/stack.md` (§1.3 o §5.8) y MI-48 en Jira.

## Fuera de alcance

El dashboard y el shell de la app (MI-20 a MI-28), el aislamiento del resto de los recursos (MI-50), la
aceptación de asignaciones pendientes (MI-46), y el diseño del estado en el `.fig` (MI-17).

## Bitácora

- 2026-10-06 — Documento creado. Medido: el backend ya soporta el flujo, el dashboard y el shell no
  existen, y el estado no está diseñado. Decisiones del usuario: alcance completo con pantalla derivada,
  y ruta propia con guardia.
