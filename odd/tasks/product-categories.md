# Categorías de producto — vista propia y selector en el producto

Construye la feature de categorías que la tabla ya modela: CRUD por empresa, vista propia y selector
en el alta/edición de producto, sin migración.

## Specs

S1. **Pedido del humano.** Textual:

> Ahora hay algo que hace falta y colocarle las categorias a los productos, existe una tabla de
> categorias. Que propones crear una vista para crear las categorias y luego colocar un combobox en
> el formulario de creación y edición de producto donde se coloquen las categorias o hacer lo
> directamente en los formularios?

S2. **Decisión del humano.** Eligió "Vista de categorías + combobox" y aceptó los defaults
propuestos: baja dura con guard, categoría opcional, permiso `manage_products`, y `categoryName`
resuelto en el producto.

S3. **Modelo.** `Category { id, companyId, name, createdAt, updatedAt }` ya existe con
`@@unique([companyId, name])` y `Product.categoryId` nullable con `onDelete: Restrict`
(`apps/api/prisma/schema.prisma:124-136,151,157`). Sin migración y sin soft delete: la categoría no
es historial de auditoría.

S4. **API por empresa.** Bajo `/companies/{companyId}/categories`:

| Método | Ruta | Respuesta | Errores |
| --- | --- | --- | --- |
| GET | `/categories` | 200 lista ordenada por nombre y luego id | 401, 403 (`company_access_forbidden`), 500 |
| POST | `/categories` | 201 categoría creada | 400, 401, 403, 409 (`category_name_already_exists`), 500 |
| PATCH | `/categories/{categoryId}` | 200 categoría editada | 400, 401, 403, 404 (`category_not_found`), 409 (`category_name_already_exists`), 500 |
| DELETE | `/categories/{categoryId}` | 204 | 401, 403, 404 (`category_not_found`), 409 (`category_in_use`), 500 |

`name` es 1..120 tras trim, igual que proveedor y cliente, y la unicidad es **case-sensitive** porque
el índice lo es (misma regla que proveedores). Leer lo puede cualquier membership `ACTIVE`; escribir
requiere `manage_products` (OWNER/ADMIN), sin fila nueva en `can()`. Una categoría de otra empresa
responde el mismo `404` que una inexistente.

S5. **Contrato.** `openapi.yaml` suma las rutas y el schema `Category`; se regenera
`apps/web/lib/api/openapi.d.ts` y el test de drift queda en verde. La respuesta de producto suma
`categoryName: string | null` para que la UI no tenga que cruzar catálogos cacheados.

S6. **Vista.** `/dashboard/categories` lista las categorías con alta, edición y baja en un formulario
en la misma página (como proveedores), con confirmación de baja en dos pasos y la entrada
correspondiente en la navegación.

S7. **Producto.** `POST` y `PATCH /products` aceptan `categoryId` opcional y nullable; la API valida
que la categoría exista en la misma empresa (`404 category_not_found`) antes de escribir. El
formulario de alta/edición suma el selector con la opción "Sin categoría" y el producto se lee con
`categoryName` resuelto. La columna **Categoría** del dashboard deja de mostrar "—": muestra el
nombre o "—" cuando el producto no tiene categoría.

S8. **Documentación.** `docs/Project.md` documenta la feature. `README.md` queda en manos del humano
(junto con el rename a "Stock mínimo"), así que este feature no lo edita; al cerrar se propone el
texto exacto para esa sección.

S9. **Verificación.** Suites de API y web en verde, `check-types` en las dos apps, `biome check .`
limpio y drift de OpenAPI en verde. La baja de categorías es una operación destructiva sobre datos
almacenados: recibe verificación independiente.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | API: entidad, errores, repositorios, casos de uso, validador, controller, rutas y tests | S3, S4 | worker | — |
| T2 | Contrato OpenAPI + regenerar tipos web | S5 | worker | — |
| T3 | Web: vista `/dashboard/categories` con CRUD, hooks, navegación y tests | S6 | worker | — |
| T4 | Producto: `categoryId` en alta/edición, validación de empresa y `categoryName` | S5, S7 | worker | — |
| T5 | Selector de categoría en el formulario y columna del dashboard | S7 | worker | — |
| T6 | `docs/Project.md` y texto propuesto para README | S8 | parent | — |
| T7 | Verificación integral + verificación independiente de la baja | S9 | parent | — |
| T8 | Fuera de alcance: filtro por categoría (PROD-04) y gráfico por categoría (DASH-02) | S1 | — | — |

## Log

L1. Pedido del humano, textual: el bloque de S1.

L2. Propuesta del orquestador: vista propia + combobox, porque la tabla ya tiene unicidad por empresa
y hoy no hay dónde renombrar ni borrar; crear categorías dentro del formulario invita a duplicados y
mezcla dos ciclos de vida. Alternativa ofrecida: crear solo desde el formulario. El humano eligió
"Vista de categorías + combobox".

L3. Decisiones de diseño: baja dura con `409 category_in_use` (el `onDelete: Restrict` ya protege,
y una categoría no es historial); categoría opcional (`categoryId` nullable como hoy); permiso
reutilizado `manage_products`; `categoryName` resuelto en el servidor para no unir catálogos en el
front. Fuera de alcance: PROD-04 y DASH-02.

L4. Estado de la rama al arrancar: el worktree sigue en `fix/dashboard` con el slice A del umbral sin
commitear. Los commits y las ramas los decide el humano; el feature se implementa igual y la
separación queda a cargo de él al commitear.

L5. Implementación (T1-T5), sin commit. API: ABM con `404 category_not_found`,
`409 category_name_already_exists` y `409 category_in_use`; guard de baja (rol primero, conteo con
productos dados de baja incluidos, `deleteMany` con `companyId`, `P2003` → `in_use` y re-conteo);
`findByIds` por lote para resolver `categoryName`. Producto: `categoryId` escribible con validación
de empresa, `categoryName` resuelto en list/get/restore. Web: `/dashboard/categories` con listado,
alta, edición y baja con `Modal`; selector **Categoría** en el alta/edición de producto; la columna
**Categoría** del dashboard muestra el nombre o "—". Contrato OpenAPI + `openapi.d.ts` regenerado.
Verde: API **83 suites / 1336 tests**, web **139 suites / 1120 tests**, `check-types` en las dos apps
y `biome check .` limpio (660 archivos).

L6. Verificación independiente (T7, `gentle-ai-verify`): **PASS** en los ocho puntos auditados (guard
de baja, tenencia, permisos, nombres, referencia de producto, contrato, UI y cobertura), sin
bloqueantes. Cerró dos huecos: (i) la rama `in_use` del caso de uso no tenía test — se agregaron
`categories-delete-guard.test.ts` (3 tests: rol antes de leer, producto dado de baja, otra empresa) y
`categories-delete-race.test.ts` (4 tests: `in_use` con re-conteo, piso 1, `not_found`, `deleted`),
probados contra seis mutaciones del código; API **83/1336** verde. (ii) La traducción `P2003` y la
carrera real contra la FK `RESTRICT` solo están probadas con dobles: **requieren Postgres**, quedan
como riesgo residual aceptado (la FK existe en la migración inicial).

L7. README (S8): no se editó porque el humano lo tomó, incluido el rename a "Stock mínimo"; se le
propusieron las cuatro frases exactas a reemplazar (el auditor marcó que hoy afirma que `categoryId`
no se expone). `docs/Project.md` sí quedó sincronizado. La pantalla de alta/edición de categoría no
esconde el formulario a un MEMBER (la API responde 403), igual que las pantallas equivalentes de
producto: comportamiento aceptado, no un defecto de permisos.

L8. Restos en `/tmp` para que el humano borre: `/tmp/verify-cat-fD5vkg`,
`/tmp/categories-delete-mutation.FDZQ60` y `/tmp/gpqkBhjq/ga8zjT7W/tmp.bCnAQj97QZ`.
