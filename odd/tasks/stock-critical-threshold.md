# Stock crítico — umbral configurable y productos por unidad

Corrige la determinación de stock crítico (el umbral existe en el modelo pero no se puede
configurar) y prepara el alta de productos que se venden por unidad, no por medida.

## Specs

S1. **Pedido del humano.** Textual:

> El stock critico no se esta determinando correctamente, en que sentido, tengo un producto
> registrado en este caso rollos plasticos pero este de manera diferente tenemos los rollos que
> entrar con diferentes pesos, pero a la final lo que tenemos es n cantidad de productos. Pero no se
> ve reflejado en el dasboard recuerda que como pueden entrar productos, por kilo, peso, etc tambien
> hay productos que entrar sin unidades de medidas que son por asi decirlos productos por unidades

S2. **Umbral de stock configurable (NOTIF-01).** `lowStockThreshold` se acepta opcional y entero
`>= 0` en `POST /companies/{id}/products` y en `PATCH /companies/{id}/products/{productId}`; ausente
en el alta usa `0` y ausente en el patch no cambia. Lo escribe quien puede `manage_products`
(OWNER/ADMIN), igual que el resto del producto. El cálculo del dashboard no cambia: crítico es
`stockQuantity <= lowStockThreshold` (inclusive) y `stockQuantity === 0` es "agotado".

S3. **Productos por unidad (diferido, requiere decisión).** El enum `MeasureUnit` no tiene una
opción "por unidad" (`KILOGRAM | LITRE | METRE`) y el alta de compra exige "medida de cada unidad".
El alcance elegido por el humano para este fix incluye agregar esa unidad; queda **pendiente**:
(a) nombre del miembro del enum y etiqueta visible, (b) qué pide el formulario de entrada para un
producto por unidad (cantidad de piezas, sin medida), (c) migración del enum. No se implementa en
este slice.

S4. **Síntoma reportado.** El humano describió el comportamiento actual así, textual:

> Solo muestra el producto referencia es decir 1 rollo de 300 mts aunque tenga varios

Ese síntoma **no** lo explica S2 (el umbral cambia *cuándo* aparece, no *cuánto* muestra). Antes de
cerrar el fix hay que explicarlo con datos del producto (`stockQuantity`, `availableUnits`,
`availableMeasure` e historial de lotes/movimientos); si es un defecto distinto, se registra aparte.

S5. **Contrato y documentación.** `openapi.yaml` documenta el campo en las dos requests y se
regenera `apps/web/lib/api/openapi.d.ts`; README y `docs/Project.md` describen el umbral y dejan de
decir que es "server-owned".

S6. **Verificación.** Suites de API y web en verde, `check-types` en las dos apps, `biome check .`
limpio y el test de drift de OpenAPI en verde.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | API: umbral en alta y edición (validador, entidad, casos de uso, repositorio Prisma/in-memory) | S2, S5 | worker | — |
| T2 | Web: campo "Stock mínimo" en el formulario de alta/edición y validación | S2 | worker | — |
| T3 | Contrato OpenAPI + regenerar tipos web | S5 | worker | — |
| T4 | Sincronizar README y `docs/Project.md` | S5 | worker | — |
| T5 | Verificación integral | S6 | parent | — |
| T6 | Diagnosticar el síntoma de S4 con datos del producto | S4 | parent | — |
| T7 | Productos por unidad: enum, migración y flujo de entrada (bloqueada por S3) | S3 | — | — |

## Log

L1. Pedido del humano, textual: el bloque de S1.

L2. Respuestas del humano al alcance: "Umbral de stock configurable" y "Unidad de medida \"por
unidad\""; sobre el caso concreto: "Solo muestra el producto referencia es decir 1 rollo de 300 mts
aunque tenga varios".

L3. Diagnóstico (orquestador): `isCritical` vive en
`apps/web/src/features/dashboard/lib/dashboard-metrics.ts:51-53` y compara `stockQuantity <=
lowStockThreshold`, pero el umbral no se puede escribir: el validador lo descarta
(`apps/api/src/interfaces/http/validators/product-validator.ts:69-75`), no está en el formulario y la
columna nace en `0`. Resultado: "crítico" equivale a "agotado". Tests existentes lo fijan
(`apps/web/src/features/dashboard/lib/__tests__/dashboard-metrics.test.ts` y
`apps/api/tests/products.test.ts`).

L4. Decisión: se implementa A (umbral) como primer slice porque es el defecto que el humano nombró,
no requiere migración y destraba el dashboard; B (por unidad) va después de decidir el flujo de
entrada, porque toca el enum, una migración y el formulario de compra.

L5. Decisión: el permiso del umbral es el del resto de la escritura de producto (`manage_products`),
sin fila nueva en `can()`; el dashboard ya lo consume sin cambios.

L6. Slice A implementado y verificado sobre `fix/dashboard` (sin commit: los commits los decide el
humano). T1-T4: `lowStockThreshold` acepta un entero `>= 0` en `POST` y en `PATCH`; ausente en el
alta usa `0` y ausente en el patch no cambia; un `0` explícito es un valor. Permiso `manage_products`
y sin migración. El formulario suma **Stock mínimo** (default `0`, preloadado en la edición), el
`openapi.yaml` y `openapi.d.ts` quedaron regenerados, y README y `docs/Project.md` sincronizados.
Verificación: RED observado por el worker antes de implementar (22 fallas de API y 14 de web); verde
API **76 suites / 1208 tests** y web **130 suites / 1053 tests**, más la re-corrida del orquestador
sobre los suites tocados (API 7/265, web 20/296), `check-types` en las dos apps y `biome check .`
limpio. Pendientes: S4 (explicar el conteo reportado) y S3/B (productos por unidad).

L7. Entrega en dos commits sobre `fix/dashboard`, decidida por el humano: `8a2f98b` — el feature de
categorías, y el commit siguiente — este slice del umbral con el rename a "Stock mínimo" y los docs.
La separación obligó a aislar primero el árbol de categorías porque `openapi.yaml`, `openapi.d.ts` y
los archivos de producto llevan cambios de ambas features; ese árbol intermedio se verificó con las
suites completas (API 83/1311, web 139/1108) antes de commitear.
