# MI-40 — Cloudinary: configuración y firma de subida

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-40 (`To Do`)

## Objetivo

Dejar Cloudinary **configurado y usable**: la API firma la subida y el cliente sube **directo** al
proveedor. Es el prerequisito de las fotos de producto (Fase 2, MI-7), no la UI de productos.

## Contexto medido

| Pieza | Estado |
|---|---|
| Decisión de arquitectura | ✅ `docs/stack.md:21` — *"Storage de imágenes: **Cloudinary**, con **subida directa** desde el cliente"*; `:301` la subida directa evita el límite de payload de ~4.5 MB y el filesystem efímero de serverless |
| Alternativas descartadas | ✅ `stack.md:122` **multer** descartado; `:153` **Supabase Storage** descartado en favor de Cloudinary |
| Layout previsto | ✅ `README.md:169` ya reserva `storage/ # Cloudinary (firma de subida)` — **firma**, no subida server-side |
| Dependencia | ❌ `cloudinary` **no está** en ningún `package.json` ni en `bun.lock` |
| Código de subida | ❌ No existe |
| Variables `CLOUDINARY_*` | ❌ No existen ni se leen (llegan con esta tarea; MI-37 las deja listadas en el `.env.example` raíz) |
| Dependencias declaradas | ✅ `stack.md:113,234` listan `cloudinary` como dependencia del backend |

**Lo que ningún doc asigna**: el flujo de fotos de producto es de **MI-7** (Fase 2). MI-40 es la
configuración y la firma.

## Decisiones de diseño

1. **Sólo la firma, nunca el binario por el servidor.** La API expone un endpoint que devuelve la firma (y
   el resto de los parámetros que Cloudinary necesita); el navegador sube el archivo directo al proveedor.
   Un upload server-side contradice `stack.md:21,301` y el filesystem efímero de serverless.
2. **El endpoint es de empresa**: `POST /companies/:companyId/media/signature`, detrás de
   `requireAuth` + `requireUser` + **`requireCompanyContext`**. La firma es un permiso de escritura: si no
   está atada a una empresa con membership activa, cualquier autenticado podría firmar subidas a nombre de
   cualquiera. **Esto además le da al primitivo de MI-50 su primer consumidor de producción real** — el
   verificador de MI-50 había anotado que no tenía ninguno.
3. **Las credenciales se validan al arrancar**, no al primer uso: `CLOUDINARY_*` entra en `loadEnv()`
   (`apps/api/src/config/env.ts`) con la misma disciplina que las de Auth0, y los secretos quedan en la
   lista de `SECRET_VARIABLES` (`:41-45`). Un arranque sin credenciales falla fuerte, no en silencio.
4. **Adaptador en `infrastructure/storage/`**, siguiendo el layout ya previsto (`README.md:169`) y el
   patrón de los otros adaptadores (puerto en `application/ports`, implementación en `infrastructure/`).
   El dominio no aprende qué es Cloudinary.
5. **Los parámetros de subida se fijan en el servidor** (carpeta por empresa, formatos permitidos, tamaño
   máximo). Firmar "lo que pida el cliente" convierte el endpoint en un proxy de subidas arbitrarias.
6. **Nada de subida ni borrado de archivos acá**: MI-40 entrega la firma y su verificación; la UI, la
   asociación al producto y el borrado son MI-7.

## Unidades de trabajo

- **U1 — Configuración y adaptador (delegada, test-first)**: dependencia `cloudinary`, `CLOUDINARY_*` en
  `env.ts` + `SECRET_VARIABLES`, puerto + adaptador en `infrastructure/storage/`, y tests con el cliente de
  Cloudinary **falso** (nunca la cuenta real).
- **U2 — Endpoint de firma (delegada, test-first)**: `POST /companies/:companyId/media/signature` detrás
  de los tres middlewares, con parámetros de subida fijados por el servidor, y tests de integración
  (miembro firma; no-miembro 403; sin token 401; parámetros que el cliente intente inyectar se ignoran).

## Fuera de alcance

La UI de subida y la asociación al producto (MI-7) · borrado de imágenes · transformaciones de entrega
(el helper `cloudinaryImageUrl` de otro proyecto es un patrón, no parte de esta tarea) · el panel de
Cloudinary · subida server-side.

## Ruta y presupuesto

Delegada en dos unidades. **Test-first** aplicable (Jest con el SDK falso). Presupuesto ~200-300 líneas por
unidad. **No se corre nada contra la cuenta real de Cloudinary**: los tests usan un cliente falso y la
verificación contra el proveedor queda declarada como límite.
