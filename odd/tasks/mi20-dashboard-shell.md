# MI-20 — Shell de la app y dashboard visual

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-20 (`To Do`)

## Objetivo

Construir el **shell de la aplicación** (sidebar + topbar) que hoy no existe y la **vista de dashboard**
dentro de él, derivadas de `design/exports/02-dashboard.png`. Es la primera vista que le da destino real
a la guardia `RequireActiveCompany` y a `/sin-empresas`, que hasta ahora apuntan a un placeholder.

**Criterios**: viven en Jira y **no hay herramientas MCP de Atlassian en esta sesión**. Fuente local:
`design/exports/02-dashboard.png` (mapeo MI-20 en `odd/tasks/design-app.md:181`) y el design system ya
existente.

## Contexto medido

| Pieza | Estado |
|---|---|
| Export del dashboard | ✅ `design/exports/02-dashboard.png` (y `10-dashboard-modo-oscuro.png`, `09-flujo-navegacion.png`) |
| Design system | ✅ `Alert`, `Checkbox`, `DataTable`, `SelectField`, `TextField`, `KpiCard`, `StockBadge`, `designTokens` (`components/design-system/index.ts:1-10`) |
| Piezas de empresa reutilizables | ✅ `use-companies.ts`, `store/company-store.ts:15-18`, `company-selectors.ts`, `company-switcher.tsx`, `no-companies-state.tsx`, `require-active-company.tsx` (guardia en 4 estados, lista para envolver) |
| **App shell / sidebar** | ❌ **No existe**: `company-switcher.tsx:20-21` lo dice textual; `app/layout.tsx:31-41` sólo monta `Provider` + `ThemeToggle`; la sidebar vive como token CSS (`app/globals.css:171`), no como componente |
| Datos | ❌ Sólo empresas. KPIs, alertas y stock necesitan productos (MI-6/MI-7) y movimientos (MI-9) |
| `/` | ⚠️ Placeholder "Home" con un link al design system; la regla inversa de `/sin-empresas` apunta ahí |

## Decisiones de diseño

1. **El shell entra en MI-20** (decisión del usuario): sidebar oscura con la navegación del diseño,
   topbar con el **switch de empresa** (ya existente), el área de usuario con **logout** (MI-54) y el
   theme toggle, y el contenido. Primera ruta dentro del shell: **`/dashboard`**.
2. **El nav se deriva del diseño pero no miente**: las rutas que todavía no existen (productos,
   movimientos, clientes) se muestran **deshabilitadas con su MI**, no como links que dan 404.
3. **Datos mixtos, y el mock se declara** (decisión del usuario): la empresa activa, el switch y el
   estado "sin empresas" son **reales** (vienen de `GET /companies`); los KPIs, las alertas de stock y
   la tabla van con datos **estáticos de un único módulo `mock.ts`**, con un aviso visible de que son de
   muestra. Nunca se presentan como datos reales, y el día que MI-6/MI-9 existan se reemplaza el módulo,
   no la vista.
4. **`/` deja de ser placeholder**: pasa a redirigir a `/dashboard`. La **regla inversa** de
   `/sin-empresas` (`app/sin-empresas/page.tsx:23`) y el destino del 401 de la guardia se actualizan a
   `/dashboard`. Es el cambio que cierra el circuito: sin empresa → `/sin-empresas`; con empresa →
   `/dashboard`.
5. **`RequireActiveCompany` envuelve el shell**, no cada página: así ninguna ruta interna se renderiza
   sin empresa activa y la regla queda en un solo lugar.
6. **Modo oscuro**: el dashboard se construye con los tokens del design system, así que el modo oscuro
   (`10-dashboard-modo-oscuro.png`) sale casi gratis; el pulido fino sigue siendo MI-28.

## Unidades de trabajo

**Coordinación de worktree (2026-10-07)**: el humano tiene trabajo **sin commitear** en
`apps/web/app/page.tsx` (y en `login-form.tsx` y el rename de `AlertToast`). Por eso `app/page.tsx` queda
**fuera de las superficies de U1** y el redirect `/` → `/dashboard` se **posterga** a una unidad de cierre,
hasta que su edición se asiente. U1 entrega el shell, la ruta `/dashboard` envuelta por la guardia, y la
regla inversa de `/sin-empresas` apuntando a `/dashboard` — sin tocar su archivo. El circuito queda
incompleto a propósito y se declara así: `/` sigue siendo lo que él está escribiendo.

- **U1 — Shell y rutas (delegada, test-first)**: `AppShell` (sidebar + topbar + contenido), nav derivado
  del diseño con rutas deshabilitadas, `app/dashboard/page.tsx` envuelto por la guardia y el shell, la
  regla inversa de `/sin-empresas` y el destino del 401 de la guardia a `/dashboard`, y sus tests.
  **Excluye `app/page.tsx`** (ver coordinación de worktree).
- **U2 — Vista del dashboard (delegada, test-first)**: KPIs, alertas de stock y tabla con
  `KpiCard`/`Alert`/`StockBadge`/`DataTable` sobre el módulo `mock.ts` marcado, estado vacío cuando no
  hay empresa activa, y sus tests.
- **U3 — Cierre del circuito (postergada)**: `/` deja de ser placeholder y redirige a `/dashboard`. Se
  hace cuando la edición del humano en `app/page.tsx` esté commiteada.

## Fuera de alcance

MI-21 a MI-28 (las otras ocho vistas y el pulido de navegación/modo oscuro) · MI-6/MI-7/MI-9 (los datos
reales detrás de los KPIs) · MI-10/MI-11/MI-12 (clientes y notificaciones) · el backend del dashboard ·
el `.fig` (decisiones #5, #6 y #7 del plan: el estado "sin empresas" sigue sin estar en el diseño, y
este trabajo lo implementa derivándolo, como ya hizo MI-48).

## Ruta y presupuesto

**Ruta**: delegada (`gentle-ai-worker`) en dos unidades. Trigger: multi-file write en cada una.
**Test-first**: aplicable (Jest + Testing Library con la guardia y la query mockeadas).
**Presupuesto**: ~300–400 líneas U1, ~300–450 U2.

## Bitácora

- 2026-10-07 — Documento creado tras la exploración. Se confirmó que **no existe app shell ni sidebar**
  (sólo el token CSS) y que los datos del dashboard no existen en la API. Decisiones del usuario: el
  shell entra en MI-20, y los datos son mixtos (empresa real + mock marcado).
