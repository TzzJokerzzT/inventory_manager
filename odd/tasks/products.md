# Productos — CRUD con SKU único por empresa (MI-7)

Primer módulo de negocio del inventario: catálogo de productos por empresa sobre el sub-router
`companyScoped` que ya resuelve membresía y rol, con contrato OpenAPI, UI de lista y formulario, y
sincronización de la documentación del repo.

## Specs

S1. **Alcance funcional (MI-7).** El README define el milestone así, textual:
> **Gestión de productos.** Alta, edición y baja lógica con nombre, descripción, precio, foto y
> **código SKU único dentro de cada empresa** (MI-7; vistas MI-21 y MI-25).

Las dos vistas son la lista (MI-21) y el formulario de alta/edición (MI-25). El stock (`stockQuantity`)
**no** se escribe desde productos: lo mueven las entradas y salidas de MI-8. El umbral de stock bajo
(`lowStockThreshold`) queda en el default de la base hasta MI-12 (NOTIF-01).

S2. **Unicidad de SKU por empresa.** PROD-05, textual:
> Validación de unicidad de SKU por empresa

El índice `@@unique([companyId, sku])` de Postgres distingue mayúsculas, así que el servidor
normaliza el SKU a mayúsculas (trim + uppercase) y la unicidad es efectiva sin distinguir caso. El
índice también cubre las filas con `deletedAt` no nulo: un producto dado de baja **reserva su SKU**,
y recrearlo responde el mismo conflicto. Un conflicto de unicidad es `409` con código
`sku_already_exists`, tanto en alta como en edición; editar un producto conservando su propio SKU no
es conflicto. El adaptador traduce la violación `P2002` de Prisma al mismo error de dominio, para que
dos altas concurrentes tampoco escapen del contrato.

S3. **Baja lógica.** PROD-03, textual:
> Eliminación lógica de productos (soft delete)

`DELETE` marca `deletedAt` y responde `204`. Un producto dado de baja nunca aparece en listados ni
lecturas (`404`), y un segundo `DELETE` responde `404`: el recurso ya no está en el catálogo.

S4. **Aislamiento por empresa.** EMP-03, textual:
> Los productos, clientes y movimientos están **aislados por empresa**

Toda consulta filtra por `companyId` en el `WHERE`, no después en memoria. Un `productId` de otra
empresa y uno inexistente responden idéntico `404 product_not_found`, así que el endpoint no sirve
para enumerar ids ajenos.

S5. **Búsqueda.** PROD-04, textual:
> Búsqueda y filtrado de productos por nombre, SKU o categoría

Hoy se implementa **nombre y SKU**: `GET .../products?search=` compara sin distinguir mayúsculas y
por subcadena contra `name` **o** `sku`. El filtro por categoría queda fuera de este alcance porque no
existe ninguna feature de categorías (ni CRUD, ni endpoint, ni UI) y `categoryId` no se expone en el
contrato todavía; entra cuando exista esa feature (ver L4).

S6. **Autorización.** Decisión del humano, textual:
> OWNER y ADMIN escriben; MEMBER solo lee

Leer el catálogo lo puede hacer cualquier membership `ACTIVE` (el contexto de empresa ya lo prueba).
Crear, editar y dar de baja exigen `manage_products`, que la matriz resuelve como `ADMIN` u `OWNER`;
un `MEMBER` recibe `403` con código `insufficient_role`, y la regla vive en `can()` —un solo lugar—,
no en cada endpoint.

S7. **Foto del producto.** PROD-01 y PROD-06, textual:
> Creación de productos con: nombre, descripción, precio, foto, código SKU
> Carga de imagen del producto (optimización incluida)

La subida es directa a Cloudinary con la firma que ya expone
`POST /companies/{companyId}/media/signature` (MI-40): el formulario pide la firma, sube el archivo y
guarda el `secure_url` en `photoUrl`. La optimización es la entrega de Cloudinary, no un paso de
código propio. La firma decide carpeta, formatos (`jpg`, `png`, `webp`) y el techo de 5 MiB; el
formulario valida formato y tamaño antes de subir para dar un mensaje legible.

S8. **Contrato HTTP.** Cinco operaciones nuevas bajo `/companies/{companyId}/products`, todas detrás
de `requireCompanyContext`:

| Método y ruta | Qué hace | Quién |
| --- | --- | --- |
| `GET /companies/{companyId}/products?search=` | Lista productos no dados de baja, ordenados por `name` y luego `id` | Cualquier miembro |
| `POST /companies/{companyId}/products` | Alta; responde `201` con el producto | `manage_products` |
| `GET /companies/{companyId}/products/{productId}` | Lee uno; `404` si es de otra empresa o está dado de baja | Cualquier miembro |
| `PATCH /companies/{companyId}/products/{productId}` | Edición parcial; ausente = sin cambio, `null` limpia `description` y `photoUrl` | `manage_products` |
| `DELETE /companies/{companyId}/products/{productId}` | Baja lógica; `204` | `manage_products` |

`Product` en JSON:

```json
{
  "id": "uuid",
  "companyId": "uuid",
  "name": "Cafe molido 500g",
  "description": "Molido medio" ,
  "sku": "CAF-500",
  "price": "1500.00",
  "photoUrl": null,
  "stockQuantity": 0,
  "lowStockThreshold": 0,
  "categoryId": null,
  "createdAt": "2026-10-20T12:00:00.000Z",
  "updatedAt": "2026-10-20T12:00:00.000Z"
}
```

`price` viaja como **string decimal con dos decimales** (`"1500.00"`), no como number: la columna es
`Decimal(12,2)` y un float en el contrato perdería precisión en el primer redondeo. El entity
normaliza a dos decimales y rechaza negativos, `NaN`, más de dos decimales y valores fuera de
`9999999999.99`.

Validaciones del body (400 con `issues`):
`name` 1..120 tras trim · `sku` 1..64 tras trim, normalizado a mayúsculas · `price` string
`^\d{1,10}(\.\d{1,2})?$` · `description` ≤ 1000, nullable · `photoUrl` ≤ 2048, nullable y sólo `http`/`https`.

Errores: `400` body inválido o `companyId`/`productId` no UUID · `401` · `403`
`company_access_forbidden` o `insufficient_role` · `404` `product_not_found` · `409`
`sku_already_exists` · `429` · `500`.

S9. **Sincronización de documentación.** Pedido del humano, textual:
> Luego de que termines sincroniza la documentación

El README deja de afirmar que productos y gestión de miembros están pendientes (miembros ya está
implementado y el README lo lista como planificado), suma los endpoints nuevos a su tabla de
contrato y actualiza el estado del proyecto; `docs/Project.md` marca el CRUD de productos en la Fase
2 y el roadmap deja de contarlo como pendiente. Lo que no se construyó (categorías, movimientos,
notificaciones) sigue declarado como pendiente.

S10. **Verificación.** Suite completa de las dos apps en verde (baseline: API 43 suites/410 tests, web
59 suites/385 tests), `check-types` de las dos apps, `biome check .` limpio y el drift test de OpenAPI
pasando tras regenerar `apps/web/lib/api/openapi.d.ts`.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos web | S8, S10 | parent | (incluido en C1) |
| T2 | Backend: entity `Product`, puerto, errores y `manage_products` en la matriz | S1, S2, S3, S6 | worker | C1 |
| T3 | Backend: casos de uso create/list/get/update/soft-delete | S1, S2, S3, S5, S6 | worker | C1 |
| T4 | Backend: adaptadores Prisma e in-memory, controller, validador, rutas y error handler | S2, S4, S8 | worker | C2 |
| T5 | Frontend: schemas, hooks de datos y subida a Cloudinary | S1, S7, S8 | worker | C3 |
| T6 | Frontend: tabla, búsqueda, formulario alta/edición y baja | S1, S3, S7 | worker | C3 |
| T7 | Verificación integral | S10 | parent | — |
| T8 | Sincronizar README y `docs/Project.md` | S9 | parent | C4 |

## Log

L1. Pedido del humano, textual: "Comienza con productos. Luego de que termines sincroniza la documentación"

L2. Contexto previo del humano, textual: "Hazme un resumen rapido de que esta implementado hasta el momento?"

L3. Decisión del humano (respuesta a la pregunta de autorización), textual: "OWNER y ADMIN escriben; MEMBER solo lee"

L4. Decisión del orquestador: quedan fuera de alcance categorías (`categoryId` no se expone), el stock
inicial (`stockQuantity` lo mueven las entradas/salidas de MI-8) y el umbral de stock bajo
(`lowStockThreshold`, NOTIF-01/MI-12). Motivo: el README de MI-7 no los incluye y no existe la feature
de categorías; incluir campos que nadie puede administrar agrega contrato que después hay que romper.

L5. Decisión del orquestador: `price` es string decimal en el contrato, no number, porque la columna
es `Decimal(12,2)` y un float perdería precisión. El entity normaliza a dos decimales.

L6. Decisión del orquestador: el SKU se normaliza a mayúsculas porque el índice único de Postgres
distingue caso y la regla del proyecto es "único por empresa", no "único por empresa y grafía".

L7. Decisión del orquestador: las filas dadas de baja conservan el SKU reservado (`@@unique` incluye
`deletedAt`), y eso se documenta y se testea en vez de esconderse con un borrado físico.
