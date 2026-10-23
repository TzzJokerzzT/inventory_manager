# Purga física de productos — borrado definitivo condicionado

Elimina de la base un producto dado de baja, solo si no tiene movimientos. Es la segunda mitad de la
papelera: restaurar o purgar.

## Specs

S1. **Origen.** Decisión del humano tras el análisis de restore/purga, textual:
> Dale

S2. **Regla.** `DELETE /companies/{companyId}/products/{productId}/permanent` borra la fila. Solo se
permite cuando el producto **está dado de baja** (la papelera es el único punto de entrada) y **no
tiene movimientos**. El ledger es la traza de auditoría (MOV-05): la purga nunca lo toca.

S3. **Permiso.** Solo **OWNER**. La matriz gana `purge_products` (OWNER), separada de
`manage_products` porque es irreversible. Un ADMIN recibe `403 insufficient_role`.

S4. **Errores.** Ajeno/inexistente → `404 product_not_found`. Activo → `409 product_not_deleted`.
Con movimientos → `409 product_has_movements` (con el conteo). El adaptador traduce además la
violación de FK `P2003` al mismo 409: si un movimiento entra entre el conteo y el `DELETE`, la base
rechaza el borrado y el cliente recibe el 409, nunca un 500. Responde `204`.

S5. **UI.** En la papelera cada fila ofrece **Restaurar** y **Eliminar definitivamente**. La segunda
abre el `Modal` de confirmación (danger), advierte que es irreversible y que solo se permite sin
movimientos, y muestra el mensaje del 409 adentro. El botón solo se ofrece a OWNER; la API sigue
siendo el guard.

S6. **Fuera de alcance.** No hay purga en cascada ni borrado de movimientos. Un producto con
historial no se puede purgar desde la app; si alguna vez hace falta, es una operación manual de DBA
con aprobación explícita. Sin migración.

S7. **Verificación.** Suites completas en verde (baseline: API 59 suites/882 tests, web 105/787),
`check-types`, `biome check .` y drift de OpenAPI.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos | S2-S4, S7 | parent | `b41af2b` (C1) |
| T2 | Backend: `purge_products`, conteo de movimientos, purga y errores | S2-S4 | worker | `b41af2b` (C1) |
| T3 | Frontend: purga en la papelera con el Modal | S5 | worker | `da02c55` (C2) |
| T4 | Verificación integral | S7 | parent | — (verificación, sin commit) |
| T5 | Sincronizar README y `docs/Project.md` | S7 | parent | C3 (este commit de docs, pendiente al escribir) |

## Log

L1. Decisión del humano, textual: "Dale" (a la propuesta de implementar la purga física OWNER-only
con guard de movimientos y modal de confirmación, sobre la papelera ya existente).

L2. Decisión del orquestador: `purge_products` es una acción nueva de la matriz y no un flag de
`manage_products`, porque el permiso es distinto (solo OWNER) y la operación es irreversible.

L3. Decisión del orquestador: la purga exige que el producto esté dado de baja. Purgar un activo
saltaría el paso de baja y haría que el `DELETE` normal pierda sentido.

L4. Decisión del orquestador: el conteo previo de movimientos da un 409 legible sin intentar el
borrado; el `P2003` del adaptador cubre la carrera. No se borra ningún movimiento.

L5. Entrega en **dos slices** sobre `feat/refactor/product-frontend-create-product`; el push y el PR
los decide el humano. Los dos commits:

- **C1 `b41af2b` — `feat(api): purge soft-deleted products without movements`**: la fila
  `purge_products` de la matriz (solo `OWNER`) y el caso de uso `purge-product.ts` (permiso primero,
  conteo con `countByProduct` antes del borrado, `409 product_has_movements` con el conteo); el
  `ProductRepository.purge` que devuelve la unión `purged | not_found | not_deleted | has_movements`
  (el `deleteMany` con `deletedAt: { not: null }` en el `WHERE`, así que el guard va dentro del
  `DELETE`); la traducción de `P2003` a `has_movements` con re-conteo para no mentir en el mensaje; el
  endpoint `DELETE /companies/{companyId}/products/{productId}/permanent` (`204`) con sus errores
  `400/401/403/404/409/429/500` y el contrato OpenAPI (con los tipos del frontend regenerados en
  `apps/web/lib/api/openapi.d.ts`).
- **C2 `da02c55` — `feat(web): permanently delete a product from the trash`**: `canPurgeProducts`
  (OWNER, rol desconocido denegado) cableado en la papelera, el botón **Eliminar definitivamente**
  junto a **Restaurar** y el `Modal` (danger) que advierte que es irreversible y que solo se permite
  sin movimientos, con el `409` de la API adentro del diálogo y toast al confirmar.

Verificación de T4, evidencia reportada por el orquestador (no la re-corrió el worker de docs): API
**59 suites / 916 tests** y web **106 suites / 806 tests** en verde, `check-types` limpio en las dos
apps, `biome check .` limpio y drift de OpenAPI en verde. Los números de S7 (882/787 y 105) eran el
baseline de arranque: crecieron con los tests nuevos de la purga.

Nota de entrega: los workers de esta tarea (T2, T3, T5) no crearon directorios scratch fuera del
worktree; el árbol de trabajo quedó sin cachés ni rutas temporales (T5 solo tocó `README.md`,
`docs/Project.md` y este archivo).
