# Movimientos de stock — entradas, salidas y auditoría (MI-8)

Segundo módulo de negocio: entradas y salidas de inventario sobre el catálogo de productos, con
actualización atómica del stock, historial consultable y auditoría de usuario/fecha/motivo.

## Specs

S1. **Entradas.** MOV-01, textual:
> Registro de entrada de stock (compra, ajuste, devolución)

S2. **Salidas.** MOV-02, textual:
> Registro de salida de stock (venta, ajuste, daño)

S3. **Historial.** MOV-03, textual:
> Historial de movimientos por producto

El listado es de la empresa y acepta `productId` y `type` como filtros, más recientes primero.

S4. **Stock automático.** MOV-04, textual:
> Actualización automática del stock disponible

La escritura del movimiento y el cambio de `stockQuantity` ocurren en **una sola transacción**: una
entrada suma y una salida resta, y si el movimiento no se puede registrar el stock no cambia.
**Una salida nunca puede superar el stock disponible**: la resta se hace con un update guardado
(`stockQuantity >= quantity`), así que dos salidas concurrentes no pueden dejar stock negativo; la
perdedora responde `409 insufficient_stock` con el stock disponible. El stock nunca se escribe desde
el endpoint de productos: solo lo mueven los movimientos.

S5. **Auditoría.** MOV-05, textual:
> Registro de usuario, fecha y motivo en cada movimiento

El usuario sale del token (`requireUser`), la fecha la pone el servidor y el motivo es opcional. Los
movimientos son **inmutables**: no hay endpoints de edición ni de borrado, porque son la traza de
auditoría del stock.

S6. **Autorización.** Decisión del humano, textual:
> Todos los roles activos registran movimientos

Cualquier membership `ACTIVE` de la empresa registra entradas y salidas; el contexto de empresa es
el guard. Todos los roles leen el historial. No se agrega una fila nueva a la matriz de `can()`: la
regla es "miembro activo", que es exactamente lo que `requireCompanyContext` ya prueba.

S7. **Contrato HTTP.** Dos operaciones bajo `/companies/{companyId}/movements`, detrás de
`requireCompanyContext`:

| Método y ruta | Qué hace |
| --- | --- |
| `POST /companies/{companyId}/movements` | Registra un movimiento; responde `201` con el movimiento y el stock resultante |
| `GET /companies/{companyId}/movements?productId=&type=&limit=` | Lista los movimientos de la empresa, más recientes primero |

`StockMovement` en JSON:

```json
{
  "id": "uuid",
  "companyId": "uuid",
  "productId": "uuid",
  "type": "IN",
  "quantity": 10,
  "reason": "Compra a proveedor",
  "createdAt": "2026-10-21T12:00:00.000Z",
  "product": { "id": "uuid", "name": "Cafe molido 500g", "sku": "CAF-500" },
  "actor": { "id": "uuid", "fullName": "Ana", "email": "ana@x.com" }
}
```

La respuesta del alta agrega `stockQuantity` (el stock del producto **después** del movimiento).
`actor` es `null` si el usuario no se pudo resolver (nunca oculta el movimiento, igual que en
notificaciones).

Validaciones del body (400): `productId` UUID, `type` en `IN|OUT`, `quantity` entero `1..1_000_000`,
`reason` ≤ 300, nullable. `limit` en la query: entero `1..200`, default `50`.

Errores: `400` body/ids inválidos · `401` · `403` `company_access_forbidden` · `404`
`product_not_found` (producto de otra empresa, dado de baja o inexistente) · `409`
`insufficient_stock` · `429` · `500`.

S8. **UI de movimientos.** Las vistas MI-26 usan datos reales: formulario de entrada/salida con
selector de producto real (no mocks), cantidad, motivo opcional, y una tabla con tipo, producto,
cantidad, motivo, usuario y fecha. Al registrar, el stock del producto se refleja sin recargar
(invalidación de la caché de productos).

S9. **Verificación.** Suites completas en verde (baseline actual: API 48 suites/550 tests, web
76/511), `check-types` en las dos apps, `biome check .` limpio y drift de OpenAPI en verde.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos web | S7, S9 | parent | `a04b961` (C2) |
| T2 | Backend: entity `StockMovement`, puerto, errores y `findByIds` de productos | S1-S5 | worker | `21ba518` (C1) |
| T3 | Backend: caso de uso `RegisterStockMovement` (transacción + guard) y `ListMovements` | S1-S5 | worker | `21ba518` (C1) |
| T4 | Backend: adaptadores Prisma e in-memory, controller, validador, rutas y error handler | S4, S6, S7 | worker | `a04b961` (C2) |
| T5 | Frontend: schemas, hooks y formulario/tabla reales | S7, S8 | worker | `955a666` (C3) |
| T6 | Verificación integral | S9 | parent | — (verificación, sin commit) |
| T7 | Sincronizar README y `docs/Project.md` | S9 | parent | C4 (este commit de docs, pendiente al escribir) |

## Log

L1. Pedido del humano, textual: "Primero actualiza el swagger con todos los endpoint y luego comienza con movimientos de stock"

L2. Decisión del humano (permisos), textual: "Todos los roles activos registran movimientos"

L3. Verificación del Swagger: `openapi.yaml` ya documenta las 25 operaciones registradas y el test de
cobertura pasa en las dos direcciones; no faltaba ningún endpoint. La tabla de endpoints del README
sí tiene 9 filas de menos (miembros, invitaciones, notificaciones), que se completan en T7.

L4. Decisión del orquestador: `customerId` queda fuera de alcance porque la feature de clientes
(MI-11) no existe; la columna existe y queda nula. Sin endpoints de edición ni borrado: el
movimiento es la traza de auditoría (MOV-05). El umbral de stock bajo (NOTIF-01/MI-12) no se toca.

L5. Decisión del orquestador: el listado resuelve producto y actor con lecturas batch (sin N+1) y
devuelve `actor: null` si el usuario no se pudo resolver, replicando la regla de notificaciones.

L6. Cierre de la feature. Tres commits de código:

| Commit | Contenido |
| --- | --- |
| `21ba518` | `feat(api): add stock movement ledger with atomic stock updates` — entity, puertos, casos de uso, in-memory y tests |
| `a04b961` | `feat(api): expose the stock movements endpoints` — adaptadores HTTP y Prisma, contrato OpenAPI y tipos del frontend |
| `955a666` | `feat(web): wire the stock movements forms and history` — formularios, hooks y tabla del historial |

Verificación (T6): API 53 suites / 649 tests y web 83 suites / 567 tests en verde, `check-types`
limpio en las dos apps, `biome check .` limpio y el test de drift de OpenAPI en verde.

Entrega: la feature quedó en tres slices sobre la rama `feat/refactor/product-frontend-create-product`;
el push y el PR los decide el humano.

Pendiente del humano: queda un archivo de scratch de la worker de frontend en
`/tmp/movement-combobox-probe.test.tsx`, fuera del worktree; debe borrarlo el humano (esta tarea no
borra archivos).
