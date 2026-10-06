# Feature: Sistema de componentes UI (Design System) — MI-18

**Estado:** en progreso
**Fuente:** Jira MI-18 — `Sistema de componentes UI (Design System)` (subtarea de MI-17)
**Diseño fuente:** página `01 · Design System` de `design/inventory-manager.fig` (OpenPencil 0.15.1)
**Preview:** `design/exports/01-design-system.png`
**Alcance externo:** lectura de Jira (project `MI`, cloudId `44077890-4588-43c3-85e3-a78e4ac3674d`)

## Objetivo

Construir la librería de componentes base reutilizables de `apps/web`, consumiendo los tokens del
design system sin colores hardcodeados, y exponer una ruta `/design-system` que reproduzca los 8
bloques del PNG de referencia para poder validar visualmente.

## Alcance

- ✅ **Dentro:** tokens AA, `Button` del DS, `StockBadge`, `Alert`, `KpiCard`, `FormField`
  (input + select), `DataTable` densa, ruta de showcase, runner de tests de `apps/web`.
- ❌ **Fuera:** las vistas de los mockups (login, registro, dashboard, productos, movimientos,
  clientes) — son otras subtareas de MI-17. Prisma, Auth0, contrato OpenAPI. `git init`.

## Contexto verificado (2026-10-05)

| Check | Resultado |
| --- | --- |
| Tokens del DS en `apps/web/app/globals.css` | presentes (claro + oscuro), coinciden 1:1 con OpenPencil |
| `design_to_tokens` sobre el `.fig` | `tokenCount: 28`, `modeCount: 1` |
| `components/design-system/` | no existe |
| `ui/button.tsx` (shadcn base-nova) | alto 32 px; variantes `default/outline/secondary/ghost/destructive` |
| Runner de tests en `apps/web` | no hay jest/vitest configurado ni script `test` |
| `apps/api` | sí tiene `"test": "bun test"` |
| Git | el directorio **no es un repo propio**; resuelve a `$HOME`, rama `master`, 0 commits |

## Decisiones tomadas con el usuario

1. **Superficie de entrega:** librería + ruta `/design-system` con los 8 bloques del PNG.
2. **Verificación:** configurar runner real (`bun test` + `happy-dom` + `@testing-library/react`)
   y escribir tests, en vez de sólo verificación estructural.
3. **Contraste AA (hallazgo):** corregir los tokens en `globals.css` **y** en el archivo OpenPencil,
   en vez de sólo parchear el CSS o evitar los tokens.
4. **`apps/web/biome.json`:** eliminarlo (era redundante y dañaba el parseo de `globals.css`), en vez
   de restaurarlo corregido o dejarlo como estaba.
5. **Deuda de lint pre-existente:** arreglar los 8 errores de Biome en vendor de shadcn en lugar de
   documentarlos como deuda (tarea T12, agregada sobre la marcha).

## Hallazgo que motivó la decisión 3 — AA

El doc de diseño de MI-17 afirma "contraste AA en badges (relleno suave + texto oscuro del mismo
tono)", pero OpenPencil sólo define 28 variables y ninguna es ese "tono oscuro". Medido:

| Par | Ratio | Veredicto |
| --- | --- | --- |
| `warning` #F59E0B sobre `warning-soft` #FEF3C7 | 1.93:1 | falla |
| `info` #0EA5E9 sobre `info-soft` #E0F2FE | 2.42:1 | falla |
| `success` #16A34A sobre `success-soft` #DCFCE7 | 3.00:1 | sólo AA-large |
| `danger` #DC2626 sobre `danger-soft` #FEE2E2 | 3.95:1 | sólo AA-large |
| `text-muted` #94A3B8 sobre `surface` #FFFFFF | 2.56:1 | falla |

En **modo oscuro** los pares de badge ya cumplen (4.52:1 – 8.66:1); sólo falla `text-muted`
#6B7C96 (4.01:1 sobre `surface`).

### Tokens AA a aplicar (exactos)

| Token | Claro | Ratio (peor fondo) | Oscuro | Ratio (peor fondo) |
| --- | --- | --- | --- | --- |
| `success-text` | `#15803D` | 4.57:1 sobre `success-soft` | `#22C55E` | 6.54:1 |
| `warning-text` | `#B45309` | 4.51:1 sobre `warning-soft` | `#FBBF24` | 8.66:1 |
| `danger-text` | `#B91C1C` | 5.30:1 sobre `danger-soft` | `#EF4444` | 4.52:1 |
| `info-text` | `#0369A1` | 5.17:1 sobre `info-soft` | `#38BDF8` | 6.48:1 |
| `text-muted` (ajuste) | `#5F6F85` | 4.68:1 sobre `surface-muted` | `#7D8EA6` | 4.60:1 sobre `surface-muted` |
| `link` (nuevo) | `#4F46E5` | 6.01:1 sobre `bg` | `#818CF8` | 6.31:1 sobre `bg` |

> `#64748B` se descartó como candidato de `text-muted`: da 4.34:1 sobre `surface-muted`, por debajo
> de AA. `#5F6F85` es el valor más claro que pasa AA en **los tres** fondos claros
> (`surface` 5.12:1, `surface-muted` 4.68:1, `bg` 4.90:1).

Los `*-text` sólo cambian el **texto** del badge; el relleno `*-soft` y el borde siguen usando el
token semántico original. El set de OpenPencil pasa de 28 a 33 variables.

`link` existe separado de `primary` por una razón que conviene no perder: un mismo valor no puede
servir a la vez de **relleno de botón** (tiene que ser lo bastante oscuro para que el texto blanco
pase AA) y de **texto de link sobre fondo oscuro** (tiene que ser lo bastante claro). `#6366F1` es un
tono medio que falla en los dos roles: 4.47:1 con blanco encima y 4.22:1 como texto sobre `bg` en
modo oscuro.

## Tareas

### T1 — Runner de tests en `apps/web`

- [x] **T1.1** Agregar `happy-dom` y `@testing-library/react` como `devDependencies` y mover
      `jest` al mismo grupo (hoy está en `dependencies`).
- [x] **T1.2** Declarar el preload de `happy-dom` para `bun test` (`bunfig.toml`) y el script
      `"test": "bun test"` en `apps/web/package.json`.
- [x] **T1.3** Dejar un test trivial en verde que pruebe el arranque del runner.

### T2 — Tokens AA en CSS y en OpenPencil

- [x] **T2.1** `apps/web/app/globals.css`: declarar `--success-text`, `--warning-text`,
      `--danger-text`, `--info-text` en `:root` y `.dark`, ajustar `--text-muted` y
      `--muted-foreground` en ambos modos, y mapear `--color-*-text` en el bloque `@theme inline`.
- [ ] **T2.2** `design/inventory-manager.fig`: crear las 4 variables `color/*-text` en la colección
      `Inventory Manager / Tokens` vía MCP de OpenPencil y guardar el archivo.
- [ ] **T2.3** Verificar con `design_to_tokens` que el archivo ahora exporta 33 variables coherentes
      con el CSS.

### T3 — `Button` del design system

- [x] **T3.1** `apps/web/components/ui/button.tsx`: agregar el tamaño `ds` (alto 48 px = `h-12`,
      radio 8 px = `rounded-md`, texto bold 14 px) y las variantes semánticas `primary`,
      `secondary`, `ghost`, `danger` (danger = relleno sólido `destructive`).
- [x] **T3.2** Estado `disabled` del DS: superficie `surface-muted` + texto `text-muted`, sin el
      `opacity-50` genérico (el PNG lo muestra como gris plano, no translúcido).
- [x] **T3.3** No romper las variantes y tamaños que ya usa shadcn.

### T4 — `StockBadge`

- [x] **T4.1** Los 5 estados: en stock, stock bajo, agotado, en tránsito, descontinuado.
- [x] **T4.2** El estado **siempre** comunica con texto además del color (el label nunca se omite).
- [x] **T4.3** Relleno `*-soft` + texto `*-text` + borde del tono semántico.

### T5 — `Alert`

- [x] **T5.1** Variantes `warning`, `danger`, `success` con título y descripción.
- [x] **T5.2** Barra de acento a la izquierda (3 px) e ícono de `lucide-react` por variante.

### T6 — `KpiCard`

- [x] **T6.1** Label, valor, delta y dirección (`up`/`down`) del delta.
- [x] **T6.2** Estado de alerta opcional (la tarjeta "Productos con stock bajo" del PNG usa
      `warning-soft`).

### T7 — `FormField`

- [x] **T7.1** `TextInput` con estados `default`, foco (borde `primary` 2 px) y `error`
      (borde `danger` + mensaje), alto 48 px.
- [x] **T7.2** `SelectField` nativo con el mismo alto y estilo.
- [x] **T7.3** Label, texto de ayuda y mensaje de error asociados al control
      (`htmlFor`/`id`, `aria-describedby`, `aria-invalid`).

### T8 — `DataTable` densa

- [x] **T8.1** Filas de 52 px, encabezado sobre `surface-muted`, separadores de 1 px (`border`).
- [x] **T8.2** API por columnas (accesor + render) tipada en TypeScript, sin dependencia nueva.
- [x] **T8.3** El estado de stock se renderiza con `StockBadge` (no sólo color).

### T9 — Ruta `/design-system`

- [x] **T9.1** `apps/web/app/design-system/page.tsx` con los 8 bloques del PNG: paleta,
      tipografía, botones, badges, campos, KPI, alertas, tabla densa.
- [x] **T9.2** Cada bloque muestra la intención (tokens y medidas), no sólo el render.
- [x] **T9.3** Título y metadata de la sección en el `layout` sin romper la home.

### T10 — Verificación independiente

- [x] **T10.1** `bun test` en `apps/web` en verde.
- [x] **T10.2** `check-types` (Next typegen + `tsc --noEmit`) y `biome check .` en verde.
- [x] **T10.3** `bun run build` de `apps/web` en verde.
- [x] **T10.4** Test de contraste AA que recorra los pares del design system y falle si bajan de
      4.5:1.
- [x] **T10.5** Test que falle si aparece un color literal (`#rrggbb`, `rgb(`, `oklch(`) en los
      componentes del DS.
- [x] **T10.6** Verificación visual de `/design-system` contra `01-design-system.png`.

### T12 — Deuda de lint pre-existente (destapada al configurar el verificador)

- [x] **T12.1** `components/ui/card.tsx`: `organizeImports`, `useImportType` y formato.
- [x] **T12.2** `components/ui/chart.tsx`: `organizeImports`, formato y los 2 `noArrayIndexKey`.
- [x] **T12.3** `components/ui/chart.tsx:94` `noDangerouslySetInnerHtml`: arreglar de verdad si hay una
      forma acotada; si es comportamiento intencional del vendor, `biome-ignore` puntual con
      justificación, reportado explícitamente.
- [x] **T12.4** `apps/web/tsconfig.json`: formato.
- [x] **T12.5** `bunx biome check .` en la raíz, en verde.

## Evidencia

### T2 — Tokens AA

| Check | Resultado |
| --- | --- |
| `list_collections` sobre `design/inventory-manager.fig` | colección `Inventory Manager / Tokens` (`0:16`), 1 modo (`0:17`) |
| `create_variable` ×4 (`color/{success,warning,danger,info}-text`) | creadas (`0:5`–`0:8`) en el documento vivo |
| `set_variable` `color/text-muted` → `#5F6F85` | aplicado |
| `design_to_tokens` | `tokenCount: 33` (era 28), `text-muted: #5F6F85`, `link: #4F46E5` |
| `save_file` | **falla** — ver incidente 1 |

### T2 — Pendiente que necesita al humano

Las 33 variables están aplicadas en el **documento vivo** de la app OpenPencil, pero **no persistidas
en `design/inventory-manager.fig`**: el bridge MCP tiene un deadline hardcodeado
(`RPC_TIMEOUT = 2e4` en `server-KHhBr8Pj.mjs`) y el guardado de un documento de 224 KB no entra.
Un `Ctrl+S` en la app persiste los cambios; hasta entonces el `.fig` en disco sigue con 28 tokens
(`text-muted` = `#94A3B8`).

### T9 — PNG de referencia regenerado

`design/exports/01-design-system.png` fue regenerado sin cambios visuales relevantes (sólo el tono de
los textos `text-muted`). Ver incidente 2.

### T10.6 — Verificación visual (la hizo el orquestador, con navegador real)

Los writers no pueden renderizar imágenes, así que esta parte la hizo el orquestador con
Chromium 152 headless manejado por CDP:

| Paso | Comando / mecanismo |
| --- | --- |
| Lanzar navegador | `chromium --headless=new --disable-gpu --no-sandbox --remote-debugging-port=N` |
| Cliente CDP | `WebSocket` global de Node 26 + `fetch` al endpoint `/json/version` |
| Light mode | `Emulation.setEmulatedMedia` con `prefers-color-scheme: light` (el flag `--force-prefers-color-scheme=light` **no** funciona) |
| Viewport | `Emulation.setDeviceMetricsOverride` 1680×1000 |
| Medición | `Runtime.evaluate` con `getComputedStyle` y `getBoundingClientRect` |
| Captura | `Page.captureScreenshot` con `captureBeyondViewport` |

**Evidencia medida en runtime (no inferida):**

| Check | Resultado |
| --- | --- |
| Alto de filas de la tabla | `[52, 52, 52]` ✅ |
| `StockBadge` "En stock" | `rgb(21,128,61)` = `#15803D` sobre `rgb(220,252,231)` = `#DCFCE7` ✅ |
| `StockBadge` "Stock bajo" | `rgb(180,83,9)` = `#B45309` sobre `#FEF3C7` ✅ |
| `StockBadge` "Agotado" | `rgb(185,28,28)` = `#B91C1C` sobre `#FEE2E2` ✅ |
| Link "Editar" con `text-primary` | `rgb(79,70,229)` = `#4f46e5` ✅ (antes del fix de capas rendía `#0f172a`) |
| `p-4` / `px-4` / `px-2.5` | 16px / 16px / 10px ✅ (antes del fix: 0px) |
| Contenedor de contenido | centrado en x=378, w=924 ✅ (`mx-auto` también estaba muerto por el reset) |

Captura final en modo claro: `/tmp/ds-final-light.png` (1680×3017).

**Fidelidad contra `01-design-system.png`:** los 8 bloques están presentes y en orden, con la
estructura y los tokens correctos. Desviaciones de copy conocidas y aceptadas: en el bloque 5 las
etiquetas de los campos demuestran estados (default / foco / error / select) en lugar de repetir los
cuatro campos del PNG; en los bloques 6 y 7 el texto descriptivo y el caption del delta no son
literalmente los del diseño; y el header de la tabla dice `UNIDADES` donde el PNG dice `STOCK`.

### Incidentes

1. **`save_file` bloqueado (timeout duro de 20 s).** No es un problema de permisos ni de *root*: el
   bridge resuelve el root a `process.cwd()` y `save_file` responde `RPC timeout (20s)` desde
   cualquier cwd. Impacto: el `.fig` en disco queda desalineado del documento vivo.
2. **`01-design-system.png` pisado y recuperado.** `export_image` sin `ids` exporta la página
   **actual**, no la que se pasa por `page_id`; y `switch_page` es un **no-op** en esta versión
   (reporta éxito pero `get_current_page` no cambia). Resultado: un export escribió la página
   `02 · Mockups` (783×1280) sobre el preview del design system. **Recuperado byte-exacto** desde el
   adjunto `10044` de Jira vía `downloadJiraIssueAttachment` → 330 504 B, 1680×2372.
   Regla para el futuro: no usar `export_image` sin `ids` en este documento.
3. **`export_image` con `ids` de otra página falla** con `Raster export selection must stay on a
   single page`, porque la selección se resuelve en la página actual. Como `switch_page` es no-op,
   hoy **no se puede exportar** la página `01 · Design System` desde el MCP.
4. **`apps/web/biome.json` rompía la verificación.** Contenía una copia parcial del config raíz
   **sin** `css.parser.tailwindDirectives`, así que `globals.css` no parseaba
   ("Tailwind-specific syntax is disabled"), y al declararse como root anidado abortaba
   `bunx biome check .` con `Found a nested root configuration`. Eliminado por decisión del usuario.
   Backup del contenido original: `/tmp/apps-web-biome.json.bak`.
5. **`apps/web/tsconfig.json` reescrito por `next typegen`** (parte del script `check-types`):
   `jsx` `preserve` → `react-jsx` y `.next/dev/types/**/*.ts` agregado a `include`. No fue una
   edición manual y queda fuera de las superficies declaradas; reportado por el writer.
6. **BUG REAL encontrado por la verificación visual (T10.6).** `apps/web/app/globals.css` declaraba
   tres reglas **sin capa** antes de `@theme inline` y `@layer base`:

   ```css
   html, body { max-width: 100vw; overflow-x: hidden; }
   * { box-sizing: border-box; padding: 0; margin: 0; }
   a { color: inherit; text-decoration: none; }
   ```

   En CSS las declaraciones sin capa **ganan** sobre las que están dentro de un `@layer`, y Tailwind
   v4 mete sus utilidades en `@layer utilities`. Consecuencia: **todas** las utilidades de padding,
   margin y `color` en links estaban muertas en toda la app. Medido con Chromium headless sobre CDP
   en `/design-system`:

   | Elemento | Clase en el markup | padding computado |
   | --- | --- | --- |
   | `Alert` | `p-4` | `0px 0px 0px 0px` |
   | `KpiCard` | `p-4` | `0px 0px 0px 0px` |
   | `TextField` input | `px-4` | `0px 0px 0px 0px` |
   | `SelectField` | `px-4` | `0px 0px 0px 0px` |
   | `StockBadge` | `px-2.5` | `0px 0px 0px 0px` |
   | `th` / `td` de la tabla | `px-4` | `0px 0px 0px 0px` |
   | link "Editar" | `text-primary` | renderiza `#0f172a` en vez de `#4f46e5` |

   Las **alturas** sí funcionaban (`h-12` = 48px, `h-13` = 52px, `h-6` = 24px) porque `height` no
   colisiona con el reset — y por eso los tests que sólo afirman presencia de clases pasaban en
   verde. **Un test de clases no valida el cascade.** Impacto directo: el criterio de aceptación de
   MI-18 "Grid de espaciado de 4 px" no se cumplía en runtime. Bug pre-existente del bootstrap, no
   introducido por el trabajo del design system, pero bloquea el cierre de MI-18.

   Fix: envolver el preámbulo en `@layer base { ... }` preservando la intención de cada declaración
   (T14).

### Falsa alarma que también hay que registrar

La primera lectura de la captura sugirió que los badges de estado se superponían con la columna
UNIDADES. La medición con `getBoundingClientRect` lo desmintió: la celda UNIDADES termina en x=814 y
el badge ESTADO empieza en x=814 — están adyacentes, y el "4" alineado a la derecha deja 32px de
separación real. Era una mala lectura visual del screenshot, no un bug. Queda como recordatorio de
medir antes de creer lo que se ve.

### T14 — Reglas sin capa en `globals.css` (destapada por T10.6)

- [x] **T14.1** Envolver el preámbulo sin capa en `@layer base`.
- [x] **T14.2** Test de regresión `css-layers.test.ts`: falla si `globals.css` declara cualquier regla
      de estilo de nivel superior (selector que no empieza con `@` a profundidad 0 de llaves).
- [x] **T14.3** Re-medir con CDP: `p-4`/`px-4` deben computar 16px y `px-2.5` 10px.
- [x] **T14.4** `bun test`, `check-types`, `bun run build` y `biome check .` en verde.

## Estado de la verificación mandatoria

`bunx biome check .` desde la raíz: 47 archivos, **8 errores + 1 warning**, todos pre-existentes en
vendor de shadcn (`card.tsx`, `chart.tsx`) y en el formato de `tsconfig.json`. Ninguno pertenece a
los archivos de MI-18. Se resuelven en T12 por decisión del usuario.

## Desviaciones del flujo ODD

- **Sin commits por work-unit.** El directorio no es un repo git propio (resuelve a `$HOME`), así
  que no existe rama de feature ni identidad de commit que registrar. Ya estaba documentado como
  pendiente del usuario en `odd/tasks/mi2-setup-tracking.md`. Cada tarea cierra con su verificación
  observada en vez de con un commit.

## Cierre en Jira

| Acción | Evidencia |
| --- | --- |
| Comentario de cierre | `commentId: 10037` en MI-18 |
| Transición | `transitionId: 31`, `statusName: Done` |
| Estado verificado post-transición | `getJiraIssue MI-18` → `status.name: "Done"` |

MI-18 es subtarea de MI-17 (`[Fase 0] Creación del diseño de la aplicación`, que sigue `In Progress`).
No se tocó MI-17: no fue parte del pedido.

## Pendiente único que queda abierto

`design/inventory-manager.fig` en disco conserva 28 tokens y `text-muted = #94A3B8`. El documento
vivo de la app OpenPencil tiene los 33 tokens y `text-muted = #5F6F85`. Un `Ctrl+S` en la app
persiste el archivo. Si se cierra la app sin guardar, los cambios se pueden reaplicar con
`/tmp/pencil-fix-tokens.mjs` más la creación de `color/link`.

## Resumen de lo que encontró la verificación (y por qué importa)

Los 73 tests verdes iniciales **no** probaban los criterios de aceptación:

| Hallazgo | Cómo se detectó |
| --- | --- |
| Reglas sin capa que anulaban todo el padding/margin de Tailwind | Verificación visual con Chromium + CDP y `getComputedStyle` |
| Botones primary/danger y link incumpliendo AA en modo oscuro | Verificador independiente recalculando el contraste |
| El test de contraste sólo cubría modo claro | Verificador independiente leyendo el test |
| `text-white` evitando el token `--destructive-foreground` | Verificador independiente escaneando los componentes |
| Hover perdido en las variantes `secondary`/`ghost` | Verificador independiente comparando con el baseline de shadcn |
| `css-layers.test.ts` sin recursar en `@media`/`@supports` | Verificador independiente intentando derrotar el test |

Ninguno de los seis lo habría detectado la suite por sí sola.

## Verificación independiente

Un verificador independiente encontró defectos reales en el criterio de aceptación 1 (colores
hardcodeados) y en el criterio de aceptación 2 (contraste AA), más huecos en la calidad de los
tests. El fallo de contraste AA en modo oscuro fue un **fallo real de AC2** detectado por el
verificador, no un detalle menor: `#fff` sobre `--primary #6366f1` daba 4.47:1 (por debajo del
umbral 4.5:1). Resolución, con el enfoque de modo oscuro aprobado por el usuario:

### F1 — bypass `text-white` y hover del DS (`button.tsx`, `globals.css`)

- `--destructive-foreground` existía en `:root` y `.dark` pero no estaba mapeado en `@theme inline`;
  se agregó `--color-destructive-foreground`.
- La variante `danger` usaba `text-white` (color hardcodeado); ahora usa
  `text-destructive-foreground` con `hover:bg-destructive/90`.
- `secondary` y `ghost` recuperaron su feedback de hover con tokens del DS.

### F2 — contraste AA en modo oscuro (aprobado: oscurecer el relleno, mantener texto blanco)

- `.dark`: `--primary`/`--ring`/`--sidebar-primary` `#6366f1` → `#5546d8`,
  `--destructive` `#ef4444` → `#dc2626`, `--accent-foreground` `#6366f1` → `#a5b4fc`.
- `--primary-foreground` y `--destructive-foreground` se mantienen `#ffffff` (ahora pasan AA).
- Nuevo token `--link` en ambos modos (claro `#4f46e5`, oscuro `#818cf8`) y mapeo `--color-link`;
  existe separado de `--primary` porque un solo valor no puede servir a la vez de relleno de botón
  (debe ser oscuro para el texto blanco) y de texto de enlace sobre fondo oscuro (debe ser claro).
- Enlaces "Editar" de `design-system/page.tsx`: `text-primary` → `text-link`.
  `app/page.tsx` no tenía el problema.

### F3 — test de contraste en modo oscuro (`tokens.test.ts`)

Se reestructuró el bloque AA para que claro y oscuro compartan la misma tabla de pares y el mismo
helper, y se agregó el bloque oscuro con 12 pares (incluye `primary-foreground/primary`,
`destructive-foreground/destructive`, `link/bg`, `accent-foreground/accent`). El bloque oscuro se
demostró real: con `--primary` en `#6366f1` falla en 4.47:1; con `#5546d8` pasa en 6.45:1.

### F4 — hueco de recursión en `css-layers.test.ts`

El escáner sólo miraba selectores a profundidad 0, así que un `@media (...) { * { padding: 0 } }`
sin capa pasaba. Ahora recurre dentro de los cuerpos de los at-rules: cualquier selector que no sea
at-rule y que no esté léxicamente dentro de un `@layer` es una violación. Se conserva la excepción
de bloques que sólo declaran custom properties (`--*`), que es lo que hace legales a `:root` y
`.dark`.

### F5 — espaciado fuera de la grilla de 4px

Los pasos enteros de Tailwind siempre son múltiplos de 4; sólo los pasos fraccionarios rompen la
grilla. Corregidos: `stock-badge.tsx` `px-2.5`→`px-2`; `form-field.tsx` dos `gap-1.5`→`gap-2`;
`kpi-card.tsx` `gap-1.5`→`gap-2`. Nuevo `spacing-grid.test.ts` escanea los componentes del DS y
falla nombrando archivo, utilidad y valor en píxeles. Excepciones deliberadas documentadas:
`alert.tsx` `w-[3px]` (barra de acento de 3px) y `mt-0.5` (nudge óptico de 2px).

### F6 — bookkeeping de este documento

T1–T14 marcadas como hechas salvo T2.2 (guardado del `.fig`) y T2.3 (verificación del archivo en
disco con 32 tokens), que siguen pendientes del `Ctrl+S` humano por el timeout del bridge MCP.
