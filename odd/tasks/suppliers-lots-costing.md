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

L18 (corrección del humano sobre el vocabulario, verbatim): "veo que te estas enfocando en rollos, te mencione
rollos como ejemplo pero pueden ser otros productos. Para que lo tengas en cuenta". Regla para todo el front y
para los textos de la API: **nada de "rollo" en la interfaz**. Se habla de **unidad**, **medida** (con su
unidad: kg, litro, metro), **lote** y **compra**. El ejemplo de los rollos queda sólo en este documento y en
las pruebas. El modelo ya es genérico: `Product.measureUnit` y `LotUnit.measure` no saben qué se está midiendo.

L28 (pedido del humano, verbatim): "Que se pierdda la migración no hay problema / 1. Unificalos. / 3.
Traducelo en el front / Y arregla las metricas del dashboard". La unificación del mapa de unidades y la
traducción del mensaje de duplicado son **pedidos explícitos**, no cambios colaterales de L27.

Disposición del hallazgo `R3-001` (crítico, lente reliability) del lineage `review-d15dd2065ead4470`: marca la
traducción como "unrequested change to an existing user-facing message" porque juzga el rango contra L27, que
habla sólo de las métricas. Es un **falso positivo de alcance**, no un defecto: el cambio está pedido en L28 y
tiene su prueba. No se revierte. El lineage quedó abierto en `correction_required` porque el único hallazgo es
esa observación de alcance; el mismo defecto del slot de plan (cuatro rechazos previos) impide cerrarlo.

L27 (F5, métricas del dashboard): el "valor del inventario" pasa a ser **a costo** y se agrega **margen
potencial** (decisión del humano). Reglas:

- `valor = Σ (unitCost × stockQuantity)` sobre los productos con `unitCost` conocido. `unitCost` es el costo
  promedio de las unidades **disponibles** (L12), así que multiplicarlo por el stock cuenta lo que hay, no lo
  que hubo.
- `margen potencial = Σ (marginPerUnit × stockQuantity)` sobre el mismo conjunto, y **puede ser negativo**:
  vender por debajo del costo es una situación real y el número tiene que poder decirlo.
- Un producto **con stock pero sin costo conocido** (sin lotes) no aporta a ninguna de las dos cifras y se
  informa aparte: "N productos sin costo conocido". Nunca se asume el precio de lista como costo, ni se
  muestra 0 como si el costo fuera cero (L11).
- El gráfico "valor por producto" usa la misma base (costo) y **excluye** los productos sin costo, para que la
  suma de las barras coincida con la tarjeta.
- Los montos viajan como enteros en centavos con el parser existente; el margen necesita además conservar el
  **signo**.

L26 (F4, columnas de costo y margen): el catálogo muestra **costo por unidad** (`unitCost`) y **margen por
unidad** (`marginPerUnit`), que son comparables con el precio de venta; el **costo por medida** no entra en la
tabla del catálogo porque se compara contra el de otros proveedores, no contra el precio de una unidad (L20). Los
movimientos muestran **precio aplicado** y **margen**; un dato desconocido es "—", nunca 0 (L11). Los montos se
formatean con el mismo helper que el resto (`formatPrice`), y el margen negativo se muestra con su signo.

L25 (detalle de la pantalla de salida, F3b): el formulario ya sabe si el producto tiene unidades porque la lista
de productos trae `availableUnits`. Con unidades, la pantalla pide la lista (`GET /products/{id}/units`) y muestra
código, medida y costo de cada una para elegirlas; la **cantidad se deriva** de las elegidas (el campo se
deshabilita, igual que en la compra, para que no haya dos fuentes de verdad) y el precio de venta se **precarga
con `product.price`** como referencia editable — el precio real es el que se escribe, no el de lista. Sin
unidades disponibles, la pantalla no cambia respecto de hoy.

L23 (F3 se parte en dos, y por qué): el formulario de salida tiene que dejar **elegir qué unidades salen**, pero
la API sólo expone cuántas unidades disponibles tiene un lote (`ProductLotSummary.availableUnits`), no **cuáles**.
Por eso F3 empieza con una lectura nueva —`GET /companies/{companyId}/products/{productId}/units?status=`, por
defecto `AVAILABLE`— y después viene la pantalla. La alternativa (vender por cantidad y que el servidor elija las
unidades) habría escondido justamente lo que el humano pidió ver: qué unidad concreta salió y con qué costo.

L24 (regla de la pantalla de salida, F3b): con un producto que tiene unidades disponibles, el formulario pide
**qué unidades** (la cantidad de elegidas tiene que ser igual a la cantidad vendida) y **el precio escrito**, y
manda `unitIds` + `unitPrice`. Con un producto sin lotes no cambia nada: cantidad suelta, sin precio ni unidades.
Es la misma regla que L9/L10 hacen cumplir en el servidor; la pantalla la refleja, no la reemplaza.

L22 (F2b implementado + corrección de la coma): el bloque "Registrar compra por medida" quedó cerrado por
defecto en el formulario de entrada; abierto llama a `POST /lots`, deshabilita la cantidad y muestra el resumen
en vivo. El lote creado **no** lleva `measureUnit`: la unidad de "$ por medida" sale del producto, así que no se
duplica en el lote.

Corrección sobre lo que entregó el worker: el parser trataba la coma como **separador**, así que "12,5" —la
forma normal de escribir doce y medio en español— se leía como **dos unidades** (12 y 5), inventando stock y
costo con un dato corriente. Ahora la coma es **separador decimal**, los valores se separan por líneas, espacios
o punto y coma, y un token con dos comas se **reporta** en vez de partirse en dos medidas que nadie escribió. El
hint y el placeholder del campo lo dicen con esas palabras.

L21 (diseño de F2b): la compra vive en el formulario de movimientos con tipo `IN`, como un **bloque opcional**
"Registrar compra por medida", cerrado por defecto. Con el bloque cerrado nada cambia: el formulario sigue
llamando a `POST /movements` como hoy (entrada suelta). Con el bloque abierto pide **proveedor**, **$ por
medida** (con la unidad del producto: kg/L/m) y **la medida de cada unidad** (un campo por línea, para pegar la
lista), muestra en vivo `Σ medidas`, la cantidad de unidades y el total `Σ medidas × $/medida`, y el submit va a
`POST /lots`; el campo de cantidad del formulario se deshabilita porque la cantidad **son** las medidas.
La aritmética de la pantalla es informativa: la autoridad es el servidor, que deriva la medida total y reparte
el costo. Nada de "rollo" en el copy (L18).

L20 (corrección por revisión, hallazgo R3-001): `measureUnit` dice **cómo se compra** el producto (sus lotes
se pesan o se miden), **no** en qué unidad se vende. `Product.price` es el precio de venta de **una unidad**.
Etiquetar el precio del catálogo como "$ 5.900,00 / kg" fue un error mío en la instrucción de F2a: mezcla las dos
unidades y es exactamente la confusión que esta feature viene a eliminar. La columna de precio quedó en su forma
original (sin unidad) y una prueba pinnea que la medida **no** se agrega ahí; la medida se muestra donde se
elige (formulario de producto y, en F2b, el bloque de compra).

L19 (dependencia que destapó L18): `Product.measureUnit` existe en la base y en la entidad desde T5, pero se
dejó **fuera del contrato y de las respuestas** para no cambiar su forma. El formulario de compra necesita
mostrar "$ por kg" o "$ por litro" con el dato real, así que F2 arranca exponiéndolo: lectura en
`Product`/`ProductListItem`/`ProductDetail`, escritura en `CreateProductRequest`/`UpdateProductRequest`, y el
selector correspondiente en el formulario de producto.

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
