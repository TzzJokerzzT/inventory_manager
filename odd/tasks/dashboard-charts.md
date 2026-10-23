# Gráficos del dashboard — MI-14 (DASH-02)

Tres gráficos con datos reales en el dashboard: distribución del stock, evolución de entradas/salidas
y valor del inventario. Usa Recharts, que ya está en el stack.

## Specs

S1. **Ticket.** MI-14 en Jira, textual:
> [Fase 4] Gráficos en el dashboard
>
> **Requerimientos:** DASH-02
>
> **Funcionalidades:**
> - Gráficos de distribución de stock por categoría
> - Gráficos de evolución de entradas/salidas en el tiempo
> - Gráficos de valor total del inventario
> - Librería de gráficos a definir según stack frontend

S2. **Distribución de stock.** Se implementa por **estado del stock** (agotados vs con stock), no
por categoría: la feature de categorías no existe (no hay CRUD, ni endpoint, ni dato cargado; el
`categoryId` de todos los productos es nulo), así que un gráfico por categoría mostraría una sola
porción "Sin categoría". Cuando exista esa feature, el gráfico por categoría entra como reemplazo de
esta porción, no como un cuarto gráfico.

S3. **Evolución de entradas/salidas.** Reporte del servidor, agregado por día **UTC** y con relleno de
ceros para los días sin movimientos, del más viejo al más nuevo. Contrato:

`GET /companies/{companyId}/reports/movements?days=30` → `{ days, series: [{ date: "YYYY-MM-DD",
entries, exits }] }`, `days` entero `1..90`, default `30`. `entries`/`exits` son la suma de cantidades
de los movimientos `IN`/`OUT` de ese día. La lectura filtra por `companyId` y por `createdAt >= desde`
en el `WHERE`; el rango se calcula en el servidor.

S4. **Valor del inventario.** Se calcula en el cliente desde `GET /products` (que devuelve el catálogo
activo sin paginar): `precio × stock` por producto. La suma se hace en **centavos enteros** (el precio
es un string decimal), nunca en floats, y se muestra el total más un gráfico de barras con los
productos de mayor valor.

S5. **Datos reales y aviso honesto.** Los tres gráficos son datos reales de la empresa activa. El
aviso de "Datos de muestra" del dashboard se acota a los KPIs, alertas y tabla, que siguen mock
(MI-6/MI-9); los gráficos se rotulan como reales. Los gráficos usan Recharts (ya es dependencia) y
tienen estado de carga, error y vacío; el de evolución explica que son los últimos N días.

S6. **Autorización y aislamiento.** Sin permisos nuevos: leer reportes lo puede cualquier membership
`ACTIVE` (el contexto de empresa es el guard). Toda consulta filtra por `companyId`.

S7. **Verificación.** Suites completas en verde (baseline: API 58 suites/819 tests, web 93/665),
`check-types` en las dos apps, `biome check .` limpio y drift de OpenAPI en verde. Sin migración.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos web | S3, S7 | parent | `b79eef9` (C1) |
| T2 | Backend: puerto `findSince`, caso de uso del reporte, controller, validador y tests | S3, S6 | worker | `b79eef9` (C1) |
| T3 | Frontend: schemas, hook y los tres gráficos con Recharts en el dashboard | S2, S4, S5 | worker | `e9a5032` (C2) |
| T4 | Verificación integral | S7 | parent | — (verificación, sin commit) |
| T5 | Sincronizar README y `docs/Project.md` | S7 | parent | C3 (este commit de docs, pendiente al escribir) |

## Log

L1. Pedido del humano, textual: "Ahora implementemos la tarea MI-14"

L2. Ticket traído de Jira (`MI-14`, `To Do`, prioridad Medium) — el contenido completo está citado en
S1.

L3. Decisión del orquestador: el gráfico "por categoría" se implementa por **estado** porque la feature
de categorías no existe (L4 de `odd/tasks/customers.md` y de productos ya lo dejaron fuera). Inventar
categorías o mostrar una sola porción "Sin categoría" no informa nada.

L4. Decisión del orquestador: el valor del inventario se calcula en el cliente porque `GET /products`
ya devuelve el catálogo completo (sin paginar) y el precio es un string decimal; sumarlo en centavos
enteros evita el drift de floats. No se agrega un endpoint de valor.

L5. Decisión del orquestador: la evolución se agrega en el caso de uso leyendo los movimientos del
rango (no hay SQL crudo). Para el volumen de una PyME en 30/90 días es aceptable; si el volumen
creciera, el siguiente paso es un `GROUP BY` en SQL, no un cambio de contrato.

L6. Decisión del orquestador: días UTC, no locales, para que el agregado sea determinístico y no
dependa de la zona del servidor ni del navegador.

L7. Cierre de MI-14. **Commits:**

- `b79eef9` — `feat(api): add the daily movement trend report` (C1, T1+T2): el contrato
  (`GET /companies/{companyId}/reports/movements` con `days` de `1` a `90` y default `30`,
  `MovementTrendPoint` y `MovementTrendResponse`), el puerto `findSince` con sus dos adaptadores
  (Prisma y memoria), el caso de uso `get-movement-trend.ts` (agregado por día UTC, relleno de ceros y
  suma de cantidades), el controller, la ruta, el validador, sus tests, y los tipos web regenerados
  (`apps/web/lib/api/openapi.d.ts`).
- `e9a5032` — `feat(web): add real-data charts to the dashboard` (C2, T3): los schemas Valibot del
  reporte, el hook `use-movement-trend`, `chart-shell` con carga/error/vacío y los tres gráficos
  (estado del stock, valor del inventario y evolución), las libs `inventory-value.ts` y
  `stock-status.ts` con sus tests, el aviso "Datos de muestra" acotado a KPIs, alertas y tabla, y un
  mock de Recharts para los tests.

**Verificación (T4, sin commit):** API **59 suites / 844 tests** y web **99 suites / 730 tests** en
verde, `check-types` limpio en las dos apps, `biome check .` limpio y el test de drift de OpenAPI en
verde. Sin migración. Contrastado al escribir la documentación: `jest --listTests` sigue listando 59
archivos en `apps/api` y 99 en `apps/web`, y `openapi.yaml` declara 33 operaciones (el reporte es la
nueva, y el README se corrigió de 32 a 33).

**Corrección del padre en C2:** `apps/web/src/layout/__tests__/dashboard-page.test.tsx` renderizaba el
dashboard real sin un `QueryClient` (y sin la API); el padre lo ajustó en el mismo commit stubeando
los dos hooks de los gráficos (`useProducts` y `useMovementTrend`) y el módulo `recharts`, así que ese
test sigue siendo de integración de ruta y shell, no de los gráficos.

**Entrega:** dos slices sobre `feat/refactor/product-frontend-create-product`. El push y el PR los
decide el humano.

**Restos de scratch en `/tmp`** (fuera del worktree, nunca versionados) que el humano debería borrar:
`base-jest.json` y `new-jest.json` (la corrida diferencial del endpoint de movimientos, 4 suites
73 → 88 tests) más el directorio `customer-detail-diff.lOQICF`, todos con fecha del 2026-10-21, dentro
de la ventana de este slice —la atribución es sólo por fecha: `/tmp` arrastra además restos de tareas
anteriores (`mi10-*`, `mi10-differential.scratch.test.ts`, `products-base-*`, `products-base-dir.txt`,
`movement-combobox-probe.test.tsx`, `probe.test.tsx`, `served-openapi.json`)—. Ninguno se conserva a
propósito y ninguno afecta al repo.
