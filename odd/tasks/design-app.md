# Feature: Diseño de la aplicación (MI-17)

**Estado:** completado (v1) — pendiente validación del usuario
**Fuente:** Jira MI-17 — [Fase 0] Creación del diseño de la aplicación
**Archivo de diseño:** `design/inventory-manager.fig` (OpenPencil)
**Preview:** `design/exports/02-dashboard.png`

## Objetivo

Definir la experiencia de usuario y el diseño visual de Inventory Manager antes del desarrollo:
wireframes, sistema de diseño, flujo de navegación y mockups de las vistas clave, respetando las
consideraciones de MI-17 (switch de empresa, alertas de stock bajo, tablas densas, accesibilidad).

## Decisiones de diseño (v1)

- **Estilo:** SaaS admin moderno, sidebar oscuro + contenido claro.
- **Tipografía:** Inter (UI). Escala 12/14/16/20/24/32.
- **Color primario:** Indigo `#4F46E5`; hover `#4338CA`; soft `#EEF2FF`.
- **Semánticos:** success `#16A34A`, warning `#F59E0B`, danger `#DC2626`, info `#0EA5E9`.
- **Superficies:** bg `#F8FAFC`, surface `#FFFFFF`, muted `#F1F5F9`, border `#E2E8F0`.
- **Texto:** primary `#0F172A`, secondary `#475569`, muted `#94A3B8`.
- **Radios:** 6/8/12 px. **Espaciado:** 4/8/12/16/24/32 (grid de 4).
- **Densidad:** filas de tabla 52 px, controles 48 px de alto.
- **Accesibilidad:** el estado nunca se comunica solo con color (siempre texto + color);
  contraste AA en badges (relleno suave + texto oscuro del mismo tono).

## Entregables

### Tokens (variables del documento)
Colección `Inventory Manager / Tokens` con 25 variables: 17 colores, 6 espaciados, 3 radios.
Exportables a CSS con `design_to_tokens`.

### Página 01 · Design System
Paleta (19 swatches), escala tipográfica (H1–caption), botones (5 variantes),
badges de stock (5 estados), campos de formulario (4 estados), tarjetas KPI,
alertas (warning/danger/success) y tabla densa.

### Página 02 · Mockups (desktop 1440×900 + tablet 1024×768)
1. Login · Desktop
2. Register · Desktop
3. App shell · Dashboard (sidebar + topbar con switch de empresa)
4. Productos · Desktop (tabla densa, toolbar, badges de estado)
5. Producto · Formulario (modal: SKU único, precio, umbral, foto, descripción)
6. Movimientos · Desktop (tabs entrada/salida, formulario, historial)
7. Clientes · Desktop (tabla + panel de detalle con historial de compras)
8. Dashboard · Tablet (rail colapsado, KPIs 2×2, tabla de stock crítico)

### Página 03 · Flujo de navegación
Acceso → selección de empresa → app shell → módulos, más las 5 reglas de sistema
que el diseño debe sostener (aislamiento por empresa, SKU único por empresa,
salida acotada por stock, alerta de stock bajo persistente).

### Página 04 · Modo oscuro
Segundo modo de la colección de tokens (`Mode 1` = claro, `Dark` = oscuro) con los 19 tokens
de color mapeados (claro / oscuro / dónde se aplica), 5 reglas de aplicación y una **vista de
referencia completa**: el Dashboard de inventario en oscuro.

| Token | Claro | Oscuro |
| --- | --- | --- |
| color/bg | #F8FAFC | #0B1120 |
| color/surface | #FFFFFF | #131C2E |
| color/surface-muted | #F1F5F9 | #1B2537 |
| color/border | #E2E8F0 | #263349 |
| color/sidebar | #0F172A | #070C17 |
| color/text-primary | #0F172A | #F1F5F9 |
| color/text-secondary | #475569 | #A8B6CB |
| color/text-muted | #94A3B8 | #6B7C96 |
| color/primary | #4F46E5 | #6366F1 |
| color/primary-hover | #4338CA | #818CF8 |
| color/primary-soft | #EEF2FF | #1E1B4B |
| color/success | #16A34A | #22C55E |
| color/success-soft | #DCFCE7 | #052E16 |
| color/warning | #F59E0B | #FBBF24 |
| color/warning-soft | #FEF3C7 | #3B2506 |
| color/danger | #DC2626 | #EF4444 |
| color/danger-soft | #FEE2E2 | #3B0A0A |
| color/info | #0EA5E9 | #38BDF8 |
| color/info-soft | #E0F2FE | #082F49 |

Reglas: no se invierten colores (se redefine cada token manteniendo su rol); los acentos se aclaran
en oscuro; los fondos "soft" pasan a tonos muy oscuros del mismo matiz con texto en el acento
claro; la elevación es superficie más clara sobre el fondo, no sombras; espaciado, radios y
tipografía son idénticos en ambos modos.

## Tareas

- [x] T1 — Design tokens como variables del documento
- [x] T2 — Página "Design System"
- [x] T3 — Mockup Login / Register
- [x] T4 — App shell (sidebar + header con switch de empresa)
- [x] T5 — Mockup Dashboard de inventario
- [x] T6 — Mockup Productos (tabla + formulario)
- [x] T7 — Mockup Entradas/Salidas + historial
- [x] T8 — Mockup Clientes (listado + detalle)
- [x] T9 — Flujo de navegación
- [x] T10 — Variante tablet + guardado del archivo

## Trazabilidad con MI-17

| Entregable MI-17 | Cubierto por |
| --- | --- |
| Wireframes de pantallas principales | Página 02 (login, dashboard, listados, formularios) |
| Sistema de diseño | Tokens + página 01 |
| Flujo de navegación | Página 03 |
| Mockups de vistas clave | Dashboard, Productos, Movimientos, Clientes, switch de empresa |
| Diseño responsive desktop y tablet | Desktop 1440×900 + Tablet 1024×768 |

## Evidencia

- Diseño guardado: `design/inventory-manager.fig`
- Previews verificados: `design/exports/` (`03-login`, `04-productos`, `06-movimientos`,
  `07-clientes`, `08-tablet`)
- Adjuntos publicados en Jira **MI-17**: el `.fig` fuente + los 5 previews PNG.
- Verificación visual por export a PNG (layout, jerarquía, color, estado de stock).

> Los previews del Dashboard, Design System y Flujo no se pudieron exportar por el bug de
> sincronización de página activa; están completos dentro del `.fig`.

## Correcciones post-verificación

- **v1.5 — La extensión no coincidía con el formato: el archivo no se podía reabrir.** El documento
  se venía guardando como `design/inventory-manager.pen`, pero OpenPencil **solo escribe `.fig`**
  (Figma/kiwi). Su ruta de guardado serializa siempre el archivador `canvas.fig` + `thumbnail.png`
  + `meta.json`; el lector de `.pen` es un `JSON.parse` del JSON de *Pencil*, otro formato distinto.
  Resultado: el archivo tenía bytes de `.fig` con nombre `.pen` y la app fallaba al abrirlo con
  `Could not open "inventory-manager.pen": JSON Parse error: Unexpected identifier "PK"` (la firma
  ZIP `PK\x03\x04` no es JSON). Verificado headless con las librerías de OpenPencil: el mismo
  archivo decodifica **sin pérdidas** como `fig-kiwi` v101 (1428 `NodeChange`, 169 blobs, las 5
  páginas) y `parsePenFile` lo rechaza. **Fix:** renombrado a `design/inventory-manager.fig`, sin
  cambios de bytes (sha256 `6519ea78…` idéntico).
  - **Causa raíz de la escritura:** el MCP expone `save_file` / `save_document`, que reenvía la
    orden a la app; su propio schema documenta el parámetro como *"Path for the **.fig** file"*
    pero no valida la extensión, así que guardar con una ruta `.pen` produce bytes `.fig` bajo ese
    nombre. **Regla:** no volver a guardar este documento con extensión `.pen`.
  - Upstream: open-pencil/open-pencil#173 — `.pen` es **solo lectura**; *"OpenPencil can open .pen
    files, but it can't save/write them yet"* (dannote). La tabla "Supported Formats" de la doc
    confirma: `.fig` lee y escribe, `.pen` solo lee.

- **v1.4 — Modo oscuro: artboard y espaciadores.** El render oscuro repetía el bug de los espaciadores
  `grow` sin `h` (topbar de 132 px en vez de 69), y el contenido excedía los 900 px del artboard
  (banda vacía al pie). Corregido con `h={1}` en `topbar-spacer` y `head-spacer`, y artboard de
  1440×1000 para contener el contenido completo.
- **v1.3 — Texto clippeado en el flujo de navegación.** La descripción de la tarjeta "Productos"
  se cortaba ("CRUD con SKU único por empresa, precio, foto y…") porque el nodo de texto tenía
  `textAutoResize: WIDTH_AND_HEIGHT` y no envolvía. Corregido en las 5 tarjetas de módulos con
  ancho fijo 252 px + `textAutoResize: HEIGHT`.
- **v1.2 — Alturas desparejas en la fila de gráficos del Dashboard.** Las tarjetas "Stock por
  categoría" y "Distribución del valor" tenían alturas distintas. Corregido con
  `counter_align: STRETCH` en el contenedor de la fila.
- **v1.1 — Espaciadores `grow` en filas inflaban los contenedores.**
  En un contenedor `flex="row"`, `grow` expande el **ancho** (eje principal) y el alto quedaba
  en el default FIXED de 100 px, inflando el padre. Afectaba 21 nodos: el selector de
  producto y el encabezado del historial en Movimientos, las barras de distribución del
  Dashboard, los topbars y page-heads de todas las pantallas, la fila "compras recientes"
  de Clientes, la fila "Recordarme" del Login y el topbar del Tablet.
  **Fix:** alto explícito `h={1}` (el mínimo aceptado) en todo espaciador `grow` horizontal.
  Los espaciadores `grow` en contenedores `flex="col"` funcionan bien y no requieren cambio.
- **v1.0 — Donut del Dashboard.** El anillo salía de un solo color porque `strokeDasharray`
  no se aplica en SVG inline. Reemplazado por barras de progreso con porcentajes exactos.

## Hallazgos técnicos (OpenPencil)

- En JSX de autoría, `flex` + `w`/`h` son obligatorios en contenedores:
  sin `h="hug"` el frame queda FIXED en 100 px y los hijos desbordan.
- **`grow` sin `h` en un contenedor `flex="row"` deja el alto en 100 px.**
  Un espaciador horizontal necesita `h={1}` explícito; `height={0}` es rechazado (mínimo 1).
- `strokeDasharray` en SVG inline no se aplica (los círculos salen completos):
  los gráficos tipo donut deben resolverse con barras/arcos, no con dasharray.
- `node_replace_with` no recalcula layout anidado y `render` con `replace_id`
  no elimina el nodo previo: verificar y limpiar duplicados tras reemplazar.
- Export raster falla con "selection must stay on a single page" aunque la estructura
  esté íntegra en una sola página (`switch_page` no sincroniza la UI de la app).
  Reintentar tras un ciclo de switch no lo resuelve; conviene reabrir el documento.

## Subtareas en Jira (bajo MI-17)

| Clave | Subtarea | Preview adjunto |
| --- | --- | --- |
| MI-18 | Sistema de componentes UI (Design System) | `01-design-system.png` |
| MI-19 | Vista: Login | `03-login.png` |
| MI-20 | Vista: Dashboard de inventario | `02-dashboard (ef20d0ce…).png` (vigente; la versión previa queda listada) |
| MI-21 | Vista: Productos (listado) | `04-productos.png` |
| MI-22 | Vista: Registro | `03b-registro.png` |
| MI-23 | Vista: Dashboard en tablet (responsive) | `08-tablet.png` |
| MI-24 | Vista: Clientes (listado y detalle) | `07-clientes.png` |
| MI-25 | Vista: Formulario de producto (alta y edición) | `05-formulario-producto.png` |
| MI-26 | Vista: Movimientos (entradas y salidas) | `06-movimientos.png` |
| MI-27 | Flujo de navegación y reglas del sistema | `09-flujo-navegacion.png` |
| MI-28 | Modo oscuro (especificación de tokens y vista de referencia) | `10-dashboard-modo-oscuro.png` |

**Estado: 11/11 subtareas con su preview adjunto.**

## Próximos pasos

- Validar la dirección visual con el usuario (color, densidad, copy) y el modo oscuro.
- Exportar el preview pendiente (MI-28): requiere activar la página `04 · Modo oscuro` en la UI de
  OpenPencil (mismo bloqueo de página activa descrito arriba).
- Borrar manualmente el adjunto `02-dashboard.png` (id `10047`) en MI-20: el MCP no expone
  borrado de adjuntos, y Jira no versiona por nombre (agrega sufijo), así que quedan dos copias.
- Reemplazar el adjunto del `.pen` en MI-17 por `design/inventory-manager.fig`: el adjunto actual
  tiene el mismo nombre y el mismo formato mal etiquetado (ver v1.5).
- Renombrar el modo claro de la colección de `Mode 1` a `Light` cuando la API lo permita
  (no hay operación de renombrado de modos).
- Definir estados hover/focus/loading en modo oscuro.
- Extraer tokens a CSS/Tailwind (ambos modos) cuando el stack quede definido (MI-1).
