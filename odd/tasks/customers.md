# Clientes — alta, edición, baja lógica y búsqueda (MI-11)

Tercer módulo de negocio: padrón de clientes por empresa con datos de contacto, sobre el mismo
sub-router `companyScoped` que ya resuelve membresía y rol.

## Specs

S1. **Alta.** CLI-01, textual:
> Creación de clientes con datos de contacto

S2. **Edición.** CLI-02, textual:
> Edición de información de clientes

S3. **Baja lógica.** CLI-03, textual:
> Eliminación lógica de clientes

`DELETE` marca `deletedAt` y responde `204`. Un cliente dado de baja no aparece en listados ni
lecturas (`404`), y un segundo `DELETE` responde `404`.

S4. **Listado y búsqueda.** CLI-05, textual:
> Listado y búsqueda de clientes

`GET .../customers?search=` compara sin distinguir mayúsculas y por subcadena contra **nombre,
email o teléfono**. Orden determinístico: `name`, luego `id`.

S5. **Aislamiento por empresa.** EMP-03 aplica también a clientes: toda consulta filtra por
`companyId` en el WHERE. Un `customerId` de otra empresa y uno inexistente responden idéntico `404
customer_not_found`.

S6. **Autorización.** Decisión del humano, textual:
> Todos los roles activos escriben clientes

Cualquier membership `ACTIVE` crea, edita y da de baja; el contexto de empresa es el guard. No se
agrega una fila a `can()`: la regla es "miembro activo", exactamente lo que `requireCompanyContext`
prueba.

S7. **Contrato HTTP.** Cinco operaciones bajo `/companies/{companyId}/customers`, detrás de
`requireCompanyContext`:

| Método y ruta | Qué hace |
| --- | --- |
| `GET .../customers?search=` | Lista clientes activos |
| `POST .../customers` | Alta, `201` |
| `GET .../customers/{customerId}` | Lee uno; `404` si es de otra empresa o está dado de baja |
| `PATCH .../customers/{customerId}` | Edición parcial: ausente = sin cambio, `null` limpia `email`/`phone`/`address` |
| `DELETE .../customers/{customerId}` | Baja lógica, `204` |

`Customer` en JSON: `{ id, companyId, name, email: string|null, phone: string|null, address:
string|null, createdAt, updatedAt }`.

Validaciones del body (400): `name` 1..120 tras trim; `email` opcional nullable, trim + minúsculas,
formato válido, ≤254; `phone` opcional nullable, ≤40, sólo dígitos y `+ - ( ) . espacio`; `address`
opcional nullable, ≤300. Un string vacío o sólo espacios se normaliza a `null`.

Errores: `400` body/ids inválidos · `401` · `403` `company_access_forbidden` · `404`
`customer_not_found` · `429` · `500`.

S8. **UI de clientes.** `/dashboard/clients` usa datos reales: búsqueda, tabla con nombre, email,
teléfono y dirección, formulario en la misma página para alta y edición, y baja con confirmación en
dos pasos. Se eliminan los mocks y las columnas de "Compras"/"Total", que dependen de CLI-04
(asociar clientes a salidas), fuera de alcance.

S9. **Verificación.** Suites completas en verde (baseline actual: API 53 suites/649 tests, web
83/567), `check-types` en las dos apps, `biome check .` limpio y drift de OpenAPI en verde.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Contrato OpenAPI + regenerar tipos web | S7, S9 | parent | C1 |
| T2 | Backend: entity `Customer`, puerto, error y casos de uso | S1-S6 | worker | C2 |
| T3 | Backend: adaptadores Prisma e in-memory, controller, validador, rutas y error handler | S5, S7 | worker | C3 |
| T4 | Frontend: schemas, hooks y UI real de clientes | S7, S8 | worker | C4 |
| T5 | Verificación integral | S9 | parent | — |
| T6 | Sincronizar README y `docs/Project.md` | S9 | parent | C5 |

## Log

L1. Pedido del humano, textual: "Ahora creememos los endpoint para clientes(customer), crear, actualizar y eliminar. Ya tienes el modelo de supabase, y luego implementalo en el frontend"

L2. Decisión del humano (permisos), textual: "Todos los roles activos escriben clientes"

L3. Decisión del orquestador: CLI-04 (asociar clientes a movimientos de salida) queda fuera; por eso
la tabla no muestra compras/total y `customerId` sigue nulo en movimientos. Entra cuando se aborde
esa asociación.

L4. Decisión del orquestador: no hay unicidad de email porque el esquema no la define
(`@@index([companyId, deletedAt])` es lo único que hay); el email se normaliza a minúsculas para
que la búsqueda y la comparación sean canónicas, pero dos clientes pueden compartirlo.
