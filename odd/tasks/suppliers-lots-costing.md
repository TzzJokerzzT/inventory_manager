# Suppliers, purchase lots and real margin

**Branch**: `feat/session-idle-timeout` (the working branch) · **Risk**: items 1 and 3 (data: new tables and
a nullable price on the ledger; contract: new endpoints) · **Scope**: backend first, front afterwards

## Specs

S1. **El precio de venta se escribe en cada venta y es el mismo para todos los rollos.** Del pedido: "el rollo
aunque pese mas o pese menos se vende al mismo precio el precio solo varia dependiendo al cliente al que se
vaya vender, mas no del peso" y "en la venta se le coloque el precio de venta pero que tambien me permita
tener el historico de ventas a ese cliente". Consecuencia: `Product.price` queda como **precio de lista**
(valor por defecto del formulario), y el precio real vive en el movimiento (`unitPrice`).

S2. **Rollos enteros.** "No: rollos enteros": una venta elige rollos completos; no se fracciona una unidad.

S3. **Costo y precio separados, y el costo del lote se atribuye por el peso de cada rollo.** "Por peso de cada
rollo (más preciso)": `cost` de cada unidad = `measure × costPerMeasure`, y la suma de los costos de las
unidades es exactamente el costo del lote (`measureTotal × costPerMeasure`).

S4. **El proveedor es una entidad con ABM.** "Entidad proveedor con ABM": modelo propio, alta/edición/baja
lógica, y el lote lo referencia.

S5. **Orden de entrega: backend completo y después el front.** "Backend completo y después el front".

S6. **La compra es un lote.** Todo ingreso de mercadería medida registra un lote: producto, proveedor, fecha,
`measureTotal` (la medida en la unidad del producto), `costPerMeasure` ($ por medida) y `unitCount`.

S7. **El stock sigue contando unidades enteras.** `Product.stockQuantity` y `StockMovement.quantity` no cambian
de tipo: los rollos se cuentan. El peso vive en el lote y en la unidad, y se muestra como información
derivada (kg disponibles).

S8. **Coherencia stock ↔ unidades.** Para un producto que se carga por lotes, la cantidad disponible del
ledger (`stockQuantity`) coincide con la cantidad de unidades en estado `AVAILABLE`. Los movimientos previos
a esta feature no tienen unidades: la invariante aplica desde el primer lote, y se verifica en las pruebas.

S9. **Las ventas históricas no se inventan.** Los movimientos anteriores no tienen `unitPrice` ni costo: los
cálculos de margen los muestran como "sin costo" en lugar de asumir un valor.

S10. **Contrato al día.** `apps/api/openapi.yaml` documenta los endpoints nuevos y los campos nuevos, y
`apps/web/lib/api/openapi.d.ts` se regenera.

## Tasks

| ID | Spec | Alcance | Commit |
| --- | --- | --- | --- |
| T1 | S6, S7, S8 | Esquema: `Supplier`, `StockLot`, `LotUnit`, `MovementUnit`, enums `MeasureUnit`/`LotUnitStatus`, `Product.measureUnit`, `StockMovement.unitPrice`/`lotId`; migración escrita a mano | C1 |
| T2 | S4, S9 | Proveedores de punta a punta: entidad, puerto, adaptadores Prisma + in-memory, casos de uso (alta, listado, edición, baja lógica), controlador, rutas, validador, permisos (`manage_products`), tests | C2 |
| T3 | S3, S6, S8 | Lotes: entidad con sus unidades, puerto, adaptadores, `RegisterLotUseCase` (lote + unidades + movimiento `IN` en una sola operación), validador con la lista de pesos, tests de la invariante de la suma y del stock | C3 |
| T4 | S1, S2 | Venta: `unitPrice` obligatorio en `OUT`, selección de unidades (`unitIds`), marcado `SOLD`, vínculo `movement_units`, y el margen derivado en las lecturas; tests | C4 |
| T5 | S1, S9 | Lecturas: costo por medida y margen en el detalle de producto, `$/medida` del último lote por proveedor, histórico de ventas por cliente (reusa el filtro `customerId` existente); tests | C5 |
| T6 | S10 | OpenAPI + regeneración del cliente tipado del front | con cada rebanada |
| T7 | S5 | Front: proveedores, entrada de lote con pegado de pesos, venta con precio y reportes | pendiente |

## Log

L1 (user, verbatim): "Tengo una dispariedad a nivel de implementación. Dialoguemos para ver si podemos crear
una solución, voy a usar como ejemplo rollos plasticos, la empresa compra kilos de plastico a un proveedor se
lo compra a $5650 y a otro se lo compra $5900, pero el producto que la empresa recibe son rollos plasticos y
vende rollos plasticos, pero los rollos no pesan igual tienen pesos diferentes, en esta caso particular, que
es muy comun, establecer un precio general para todas la unidades es erroneo. Hay que buscar la forma de que
usuario pueda colocar el valor de la und, ejemplo compre 10 rollos el proveedor de $5900 y pero con pesos
diferentes es decir que el coloque peso y el valor la app le entregue el precio del producto y luego lo sume,
pero tambien tener la lista de los productos discriminados por precio. Estoy tomando como ejemplo los kilos
pero puede ser que un usuario compre pesos, volumen, etc. Que solución propones"

L2 (user, verbatim, las tres respuestas que fijaron el diseño): "el precio de venta es el mismo la perdida
esta en este caso de rollo pese mas de lo esperado, que eso no lo podemos controlar. Pero el rollo aunque pese
mas o pese menos se vende al mismo precio el precio solo varia dependiendo al cliente al que se vaya vender,
mas no del peso" · "No: rollos enteros" · "Costo y precio de venta separados" · "Por peso de cada rollo (más
preciso)" · "Entidad proveedor con ABM" · "Backend completo y después el front".

L3 (análisis): el esquema actual no puede representar el caso: un `price` por producto, `stockQuantity` y
`quantity` enteros, y ningún costo, lote ni unidad de medida. Se descartó "un producto por rollo" (infla el
catálogo) y "guardar el peso en el nombre/SKU" (no se puede sumar ni filtrar). También se descartó serializar
cada rollo como producto: el stock sigue siendo un contador y las unidades son el detalle del lote.

L4 (decisión de alcance): las propuestas de precio por cliente en tabla y por descuento porcentual quedaron
descartadas por el humano: el precio se escribe en cada venta y el histórico por cliente sale de los
movimientos, que ya filtran por `customerId`.

L6 (decisión de T3, evita una invariante imposible): el `measureTotal` del lote **se deriva de la suma de los
pesos de las unidades**, no se carga aparte. Si el usuario pega 10 pesos, el lote mide eso; el total de la
factura del proveedor se muestra como control ("cargaste 84,5 kg, la factura dice 85,1") y la diferencia es
justamente la pérdida que se quiere ver. Así la invariante "la suma de costos de las unidades es el costo del
lote" es cierta **por construcción** y no hay que validarla contra un número tecleado.

L7 (decisión de atomicidad de T3): lote + unidades + movimiento `IN` + incremento de `products.stock_quantity`
son **una sola operación** del adaptador (`$transaction`), no tres llamadas encadenadas: si la última falla, no
puede quedar un lote huérfano ni stock descuadrado. Las reglas (cantidad de unidades, costos, suma) viven en
la entidad, para que ni el adaptador ni el controlador las reimplementen.

L16 (decisión del front, verbatim): "Se puede realizar en el movimiento donde entra que puede ser comprar
ejemplo o entrada que puede compra del producto". La compra **no** tiene pantalla propia: vive en el formulario
de movimientos existente. Consecuencia concreta: con `type = IN` el formulario ofrece el bloque "compra por
peso" (proveedor, $/medida y los pesos) y con esos datos llama a `POST /lots`; si el bloque queda vacío, sigue
llamando a `POST /movements` como hoy (entrada suelta). Con `type = OUT` y un producto con rollos disponibles
(`availableUnits > 0` en `GET /products`), el formulario pide el precio escrito y los rollos, y llama a
`POST /movements` con `unitIds` + `unitPrice`. No hay cambio de API por esto: los dos endpoints ya existen y el
de lotes crea el movimiento `IN` en la misma transacción.

L17 (orden del front, T7): cuatro rebanadas, en este orden porque cada una habilita a la siguiente:
F1 proveedores (ABM + navegación, lo necesita el selector de la compra), F2 entrada con compra por peso en el
formulario de movimientos, F3 salida con selección de rollos y precio escrito, F4 columnas de costo y margen
(producto y movimientos) más `lastLot` del proveedor.

L13 (cierre del backend): las cinco rebanadas de datos y API están commiteadas (`f9bb1b3` esquema, `c5dd5d4`
proveedores, `b59ad34` lotes, `a07c705` venta, `7b23f0d` lecturas). Superficie resultante:

- `POST|GET /companies/{id}/suppliers`, `PATCH|DELETE /companies/{id}/suppliers/{supplierId}`
- `POST /companies/{id}/lots` (medida derivada de los pesos, una transacción)
- `POST /companies/{id}/movements` con `unitPrice` + `unitIds` para productos con rollos
- `GET /companies/{id}/movements` con `unitPrice`, `units` y `margin` por venta (histórico por cliente con
  `?customerId=`)
- `GET /companies/{id}/products` y `/{productId}` con `costPerMeasure`, `unitCost`, `marginPerUnit` y, en el
  detalle, los últimos 50 lotes con proveedor
- `GET /companies/{id}/suppliers` con `lastLot` por proveedor

Verificación al cierre: API **74 suites / 1151 tests**, web **850**, typecheck del monorepo, `biome` limpio, y el
cliente tipado del front regenerado en cada rebanada.

L14 (riesgo declarado en T5): las lecturas Prisma (`lotUnit.groupBy`, `_count` filtrado, `distinct`) están
verificadas por forma de query y tipos, **no** contra un Postgres real; el rollback de las transacciones
tampoco se ejercitó con base. Es deuda de verificación a saldar con la primera migración aplicada.

L15 (tamaño de revisión): la rebanada de lecturas pasó las 400 líneas (~1.3k). Si se abre PR, los cortes
naturales son: (1) margen del movimiento, (2) costos y lotes del producto, (3) `lastLot` del proveedor y
contrato.

L11 (fórmula del margen, T5): `unitPrice` es el precio de **una** unidad, así que el ingreso de la venta es
`unitPrice × quantity` y el costo es la suma de `cost` de las unidades que salieron. `margin = ingreso − costo`
y se calcula **en el servidor**, no en el front: es dinero y no puede depender de la aritmética de cada cliente.
Si falta el precio (venta anterior a la feature) o las unidades, el margen es `null` y la UI lo muestra como
"sin costo" — nunca `0`.

L12 (dónde viven las lecturas, T5): el costo por medida y el costo promedio por unidad **se derivan de las
unidades disponibles** (Σ costo / Σ medida y Σ costo / cantidad), no de un campo guardado, para que no haya un
número que se pueda desincronizar. El detalle de producto expone sus lotes (los últimos 50) con proveedor y
$/medida: eso es la comparación "a quién le compro". El listado de proveedores expone el último lote como
resumen. El histórico por cliente **no lleva endpoint nuevo**: es `GET /movements?customerId=` —que ya
existía— ahora con `unitPrice`, unidades y margen por venta.

L9 (regla de T4, compatibilidad hacia atrás): una salida exige `unitPrice` y `unitIds` **sólo si el producto
tiene unidades disponibles**; un producto sin lotes sigue vendiéndose como hoy (cantidad suelta, sin precio ni
unidades). Razón: el front actual no envía ninguno de los dos campos y no puede romperse mientras el front de
la feature no exista; a la vez, un producto cargado por lotes no puede venderse sin precio ni sin decir qué
rollos salieron, que es justo lo que sostiene el margen real.

L10 (dónde se hace cumplir la regla de T9): en el adaptador del movimiento, dentro de la misma transacción que
ya valida el stock, no en un `if` del caso de uso con una consulta previa. Así la regla no puede quedar
desactualizada respecto de los datos (una unidad vendida entre la lectura y la escritura) y el resultado se
comunica con los `kind` que el puerto ya usa: `units_required` y `unit_not_available`.

L8 (corrección del plan): la tarea T6 original ("contrato al final") era inviable: `tests/openapi.test.ts` exige que
el router y el documento cubran **exactamente** las mismas operaciones, en los dos sentidos, así que una rebanada
no puede existir sin su contrato. Se decidió (y se aplicó en T2) que **el contrato viaja con cada rebanada**; la
regeneración de `apps/web/lib/api/openapi.d.ts` también.

L5 (riesgo asumido): `StockMovement.unitPrice` es nullable para no inventar precios del pasado; el margen de
las filas viejas se informa como "sin costo". La alternativa (backfill con el precio de lista actual) habría
fabricado datos.
