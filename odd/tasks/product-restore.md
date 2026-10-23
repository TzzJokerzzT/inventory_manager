# Restaurar productos — papelera y deshacer la baja lógica

Permite ver los productos dados de baja y restaurarlos. La purga física queda como feature aparte.

## Specs

S1. **Origen.** Duda del humano, textual:
> Tengo una duda si el DELETE del /product solo hace un soft delete, que pasaria si el usuario decide colocar un producto nuevo con el mismo numero SKU del producto eliminado?. Tambien otra duda ¿Como hace el usuario para eliminar el producto de la base de datos?

y la decisión de avanzar con la recomendación, textual:
> Dale

S2. **Restaurar.** `POST /companies/{companyId}/products/{productId}/restore` limpia `deletedAt` y
devuelve el producto activo con su mismo SKU y su historial intacto. Es la alternativa a reciclar un
SKU, que sigue reservado mientras el producto esté dado de baja. El SKU no puede chocar al restaurar
porque el índice único lo mantuvo reservado.

S3. **Reglas.** Producto de otra empresa o inexistente → `404 product_not_found`. Producto que no
está dado de baja → `409 product_not_deleted` (no es una acción idempotente: la papelera es un
estado, no un flag). Escribe quien puede dar de baja (`manage_products` = ADMIN/OWNER). La carrera
entre dos restauraciones la resuelve el write guardado: la segunda recibe el 409.

S4. **Papelera.** `GET /companies/{companyId}/products?deleted=true` lista **solo** los productos dados
de baja, con la misma búsqueda y el mismo orden que el catálogo activo. Sin el parámetro (o
`deleted=false`) la lista sigue siendo la de activos, como hoy: el contrato no cambia para el cliente
existente. Aislamiento por empresa en el `WHERE`, igual que todo el resto.

S5. **UI.** En `/dashboard/products` hay un interruptor **Papelera** que cambia el listado por el de
productos dados de baja. En esa vista cada fila ofrece **Restaurar** (sin confirmación: es una acción
segura y reversible) y no ofrece editar ni eliminar. Al restaurar se invalida la caché de productos y
el producto reaparece en el catálogo. El alta y la edición quedan ocultas en la papelera.

S6. **Fuera de alcance.** La **purga física** (`DELETE` definitivo, OWNER-only, con el guard de
movimientos y modal de confirmación) se implementa como feature aparte, sobre esta misma papelera.
No se toca el índice único, no hay migración y el ledger nunca pierde filas.

S7. **Verificación.** Suites completas en verde (baseline: API 59 suites/844 tests, web 104/772),
`check-types` en las dos apps, `biome check .` limpio y drift de OpenAPI en verde.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos web | S2, S4, S7 | parent | C1 |
| T2 | Backend: `restore` en puerto/adaptadores, caso de uso, error y filtro `deleted` | S2-S4 | worker | C1 |
| T3 | Frontend: papelera, restaurar y hook | S4, S5 | worker | C2 |
| T4 | Verificación integral | S7 | parent | — |
| T5 | Sincronizar README y `docs/Project.md` | S7 | parent | C3 |

## Log

L1. Pedido del humano, textual: "Dale" (a la recomendación de implementar restore primero y la purga
condicionada después, con la papelera como punto de entrada).

L2. Decisión del orquestador: restaurar un producto activo responde `409 product_not_deleted` en vez
de ser un no-op idempotente, para que el cliente sepa que el estado no era el que creía (misma lógica
que el segundo `DELETE`, que responde 404).

L3. Decisión del orquestador: el listado usa `?deleted=true` en vez de un `includeDeleted`. La
papelera pide **solo** los dados de baja; devolver activos y bajas mezclados no sirve a ninguna de las
dos vistas y complicaría el filtro del cliente. El default no cambia.

L4. Decisión del orquestador: `restore` comparte el permiso de la baja (`manage_products`). La purga,
que es irreversible, irá con OWNER-only y su propia decisión.
