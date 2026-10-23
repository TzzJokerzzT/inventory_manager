# Detalle de cliente — salidas por cliente

Vista dentro de Clientes para seleccionar un cliente y ver el detalle de sus salidas (ventas), sin
cambiar la página de Movimientos.

## Specs

S1. **Pedido.** Textual:
> Ahora creemos una vista dentro de clientes donde se seleccione un cliente y se pueda observar en detalle la salida, sin quitar la que esta en movimientos

S2. **Filtro por cliente.** `GET /companies/{companyId}/movements` suma `customerId` como filtro
opcional, combinable con `productId`, `type` y `limit` que ya existen. Un `customerId` que no
pertenece a la empresa simplemente no devuelve filas: es un filtro de lectura, no un recurso, así que
no responde 404. El filtro se aplica en el `WHERE` (nunca después en memoria) y el `companyId` sigue
siendo obligatorio.

S3. **Vista de detalle.** En `/dashboard/clients`, cada fila ofrece **Detalle**. Al elegirlo se abre
un panel en la misma página con los datos de contacto del cliente y la tabla de **sus salidas**
(`type=OUT`): fecha, producto, SKU, cantidad, motivo y usuario. Se muestra además el conteo de
salidas y el total de unidades. La selección se puede cerrar y volver al listado.

S4. **Movimientos no cambia.** La página `/dashboard/movements`, su tabla, sus formularios y sus
filtros quedan exactamente como están; esta vista es adicional y de solo lectura.

S5. **Autorización.** Sin reglas nuevas: cualquier membership `ACTIVE` lee movimientos y clientes,
que es lo que el detalle necesita. No se agrega ninguna fila a `can()`.

S6. **Verificación.** Suites completas en verde (baseline: API 58 suites/804 tests, web 92/649),
`check-types` en las dos apps, `biome check .` limpio y drift de OpenAPI en verde.

## Contrato

Solo cambia la lista de movimientos:

| Método y ruta | Cambio |
| --- | --- |
| `GET /companies/{companyId}/movements?productId=&customerId=&type=&limit=` | Nuevo parámetro opcional `customerId` (uuid) |

Sin endpoints nuevos y sin cambios en la forma de `StockMovement`.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos web | T2 | parent | `93b058b` (C1) |
| T2 | Backend: filtro `customerId` en puerto, casos de uso, adaptadores y validador | S2 | worker | `93b058b` (C1) |
| T3 | Frontend: hook con el filtro y panel de detalle con las salidas | S3, S4 | worker | `3497a1d` (C2) |
| T4 | Verificación integral | S6 | parent | `—` (verificación, sin commit) |
| T5 | Sincronizar README y `docs/Project.md` | S6 | parent | `C3` (commit de docs, pendiente al escribir) |

## Log

L1. Pedido del humano, textual: "Ahora creemos una vista dentro de clientes donde se seleccione un cliente y se pueda observar en detalle la salida, sin quitar la que esta en movimientos"

L2. Decisión del orquestador: reutilizar el listado de movimientos con un filtro `customerId` en vez
de crear un endpoint por cliente. Motivo: el caso de uso, el adaptador y el contrato ya existen; un
endpoint nuevo duplicaría la lectura y el aislamiento por empresa.

L3. Decisión del orquestador: el detalle muestra solo salidas (`type=OUT`) y no calcula montos,
porque el movimiento no guarda precio; sí muestra conteo y total de unidades. El panel vive en la
misma página (como el formulario de alta/edición), sin ruta nueva.

L4. Cierre y entrega (T5). Dos commits, ambos sobre `feat/refactor/product-frontend-create-product`:

- `93b058b` — `feat(api): filter stock movements by customer` (C1, T1+T2): suma el parámetro
  `customerId` al `GET /companies/{companyId}/movements` en `openapi.yaml` y regenera
  `apps/web/lib/api/openapi.d.ts`; lo propaga por el puerto del repositorio
  (`StockMovementFilters`), el caso de uso `list-stock-movements`, los repositorios en memoria y
  Prisma —donde entra en el `WHERE` junto al `companyId`, nunca como filtro posterior— y el
  validador de la query.
- `3497a1d` — `feat(web): show each customer's sales in a detail panel` (C2, T3): `useMovements`
  acepta `customerId` en el filtro y en la clave de caché, `CustomerDetailPanel` muestra el
  contacto y la tabla de salidas, y `Client` abre el panel con la acción **Detalle**.

Verificación de T4 (S6), corrida por el orquestador: suites completas en verde —API **58 suites /
819 tests**, web **93 suites / 665 tests** (baseline del arranque: 58/804 y 92/649)—, `check-types`
limpio en las dos apps, `biome check .` limpio y el test de drift de OpenAPI en verde.

Alcance del resumen: el conteo y el total de unidades describen **las salidas listadas**, no la vida
del cliente, porque el endpoint pagina el historial (`limit`, default `50`) y no hay agregado por
cliente ni endpoint nuevo; por eso el panel dice "Se muestran las salidas más recientes". Tampoco
hay montos: el movimiento no guarda precio.

Entrega: dos slices (backend C1, frontend C2) sobre `feat/refactor/product-frontend-create-product`.
**Push y PR los decide el humano**, igual que este commit de docs (C3), que no se commitea al cerrar
la tarea.

Restos que el humano debe borrar: los directorios de scratch en `/tmp` que dejaron los workers
(`inv-base-*`, copia del commit base para el chequeo diferencial, y `customer-detail-diff.*`).
