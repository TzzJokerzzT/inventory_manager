# Dashboard con métricas básicas — MI-6

Reemplaza las tarjetas, alertas y tabla mockeadas del dashboard por datos reales de la empresa
activa. Sin endpoints nuevos: todo sale de `GET /products` y del reporte de evolución.

## Specs

S1. **Ticket.** MI-6 en Jira, textual:
> [Fase 2] Dashboard con métricas básicas
>
> **Requerimientos:** DASH-01, DASH-03, DASH-05
>
> **Funcionalidades:**
> - Visualización del número total de productos activos
> - Tabla resumen de productos con stock crítico
> - Filtrado por empresa
> - Indicador de valor total del inventario
> - Diseño responsive

S2. **KPIs reales.** Cuatro tarjetas con datos de la empresa activa:
1. **Total de productos** = cantidad de productos activos (DASH-01).
2. **Valor del inventario** = suma de `precio × stock` en centavos enteros (DASH-04; reusa el helper
   de MI-14).
3. **Productos con stock crítico** = productos donde `stockQuantity <= lowStockThreshold` (hoy el
   umbral es 0, así que son los agotados; cuando MI-12 permita editarlo, la misma regla cubre el
   "stock bajo" sin cambios).
4. **Unidades movidas hoy** = `entries + exits` del último punto (hoy, **UTC**) del reporte de
   evolución de 30 días. Se rotula que es UTC.

S3. **Tabla de stock crítico.** Filas = productos críticos (misma regla que el KPI), columnas:
Producto, SKU, Categoría (— mientras no exista la feature), Precio, Unidades y Estado con
`StockBadge` (agotado si `0`, stock bajo si está entre 1 y el umbral). Ordenada por unidades
ascendente y luego por nombre. Estado vacío cuando no hay productos críticos.

S4. **Alertas reales.** Derivadas de los mismos datos: una alerta de peligro si hay agotados, una de
advertencia si hay críticos no agotados, y un mensaje informativo cuando no hay ninguna. Sin números
inventados.

S5. **Sin mocks.** El dashboard deja de importar `@/src/utils/mockData` (se eliminan del archivo las
exportaciones exclusivas del dashboard: `dashboardKpis`, `stockAlerts`, `stockTableRows`, `StockRow`,
`DashboardKpi`, `StockAlert`; `formatDate` y el resto se conservan porque los usan otras features). El
aviso "Datos de muestra" desaparece: ya no hay datos de muestra. Los gráficos de MI-14 se conservan.

S6. **Aislamiento y responsive.** Todo se lee de la empresa activa (el contexto de empresa es el
guard); sin permisos nuevos. El layout mantiene el grid responsive actual (1 columna en móvil, 2 en
tablet, 4 en desktop para los KPIs) y las tablas scrollean horizontalmente.

S7. **Verificación.** Suites completas en verde (baseline: API 59 suites/844 tests, web 99/730),
`check-types`, `biome check .` limpio y drift de OpenAPI en verde (sin cambios de contrato). Sin
migración.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Documento de feature | — | parent | C1 |
| T2 | Frontend: KPIs, alertas y tabla reales; quitar los mocks del dashboard | S2-S6 | worker | C1 |
| T3 | Verificación integral | S7 | parent | — |
| T4 | Sincronizar README y `docs/Project.md` | S7 | parent | C2 |

## Log

L1. Pedido del humano, textual: "Ahora implementemos la tarea MI-6 Dashboard con métricas básicas, ya que las cartas que estan actualmente en el dashboard son datos mockeados"

L2. Ticket traído de Jira (`MI-6`, `To Do`, prioridad Medium) — citado completo en S1.

L3. Decisión del orquestador: el cuarto KPI es "Unidades movidas hoy" (último punto del reporte de
MI-14) en lugar del mock "Movimientos de hoy", que no tenía fuente real. Es UTC y se rotula.

L4. Decisión del orquestador: el predicado de stock crítico es `stockQuantity <= lowStockThreshold` y
no `=== 0`, para que MI-12 lo herede sin tocar el dashboard. Hoy el umbral es siempre 0.

L5. Decisión del orquestador: no se agrega endpoint. `GET /products` ya devuelve el catálogo completo
(sin paginar) y el reporte de evolución ya trae el día de hoy; un endpoint de métricas duplicaría
lecturas y contrato.
