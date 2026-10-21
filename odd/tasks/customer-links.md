# Vinculación de clientes a salidas — MI-10 / CLI-04

Asocia un cliente a un movimiento de salida (venta) y expone el cliente en el historial, sin tocar
el stock ni la inmutabilidad del ledger.

## Specs

S1. **Requisito.** MI-10 en el roadmap, textual:
> Vinculación de clientes a salidas

y CLI-04 en los requisitos, textual:
> Asociación de clientes a movimientos de salida (ventas)

S2. **Solo salidas.** `customerId` se acepta únicamente con `type: "OUT"`. Un `IN` con `customerId`
responde `400` con código `customer_requires_exit`: una entrada es una compra a proveedor, no una
venta, y aceptarla en silencio ensuciaría el historial de compras del cliente. La regla se valida en
el borde (400) y se vuelve a comprobar en el caso de uso (defensa en profundidad).

S3. **Cliente válido y opcional.** El cliente debe existir, estar activo y pertenecer a la empresa;
si no, `404 customer_not_found` (idéntico para ajeno, inexistente o dado de baja). Es **opcional**:
una venta sin cliente identificado sigue siendo válida y se guarda con `customerId: null`.

S4. **Contrato.** `StockMovement` suma `customerId: uuid|null` y `customer: { id, name } | null`.
`RegisterMovementRequest` acepta `customerId` opcional nullable. La respuesta del alta y el historial
resuelven el cliente en el servidor; `customer` es `null` solo cuando no hay asociación.

S5. **Historial legible tras la baja.** Si el cliente se da de baja lógica después de una venta, el
movimiento sigue mostrando su nombre: la lectura por lote de clientes incluye las filas con
`deletedAt` (misma regla que productos), porque el ledger es la traza de auditoría (MOV-05). Dar de
baja un cliente **no** borra ni altera sus movimientos.

S6. **UI.** El formulario de **salida** suma un selector de cliente opcional (con la opción "Sin
cliente") alimentado por el padrón real; el de entrada no lo muestra. La tabla de movimientos suma la
columna Cliente (nombre, o "—" cuando no hay). No se agregan columnas de compras/total al padrón de
clientes: el resumen por cliente es otra vista y queda fuera de MI-10.

S7. **Verificación.** Suites completas en verde (baseline: API 58 suites/773 tests, web 92/634),
`check-types` en las dos apps, `biome check .` limpio y drift de OpenAPI en verde. Sin migración: la
columna `customer_id` ya existe desde la migración inicial.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos web | S4, S7 | parent | C1 |
| T2 | Backend: entidad, puertos (`findByIds` de clientes), error y casos de uso | S2, S3, S5 | worker | C2 |
| T3 | Backend: adaptadores Prisma/in-memory, validador, controller y tests | S2-S5 | worker | C3 |
| T4 | Frontend: schemas, selector de cliente en salidas y columna en la tabla | S4, S6 | worker | C4 |
| T5 | Verificación integral | S7 | parent | — |
| T6 | Sincronizar README y `docs/Project.md` | S7 | parent | C5 |

## Log

L1. Pedido del humano, textual: "Ahora hay que realizar la tarea MI-10 Vinculación de clientes a salidas"

L2. Decisión del orquestador: `customerId` solo en `OUT` (400 `customer_requires_exit` en `IN`) y
opcional (venta anónima válida). Motivo: la asociación es "ventas" (CLI-04), y rechazar en silencio
un cliente en una entrada haría que el historial de compras mienta.

L3. Decisión del orquestador: sin migración; `stock_movements.customer_id` existe desde la migración
inicial con `onDelete: Restrict`, así que la baja del cliente es lógica y el movimiento queda legible.

L4. Decisión del orquestador: el resumen de compras por cliente (columnas "Compras"/"Total") no entra
en MI-10; es una vista derivada del ledger y se aborda aparte si se pide.
