# Rutas de escritura, términos publicados y miniatura al compartir

Tres entregas que compartieron el mismo objetivo: que cada vista de la app tenga dirección propia y que
lo que se muestra hacia afuera (términos, miniatura, contacto) sea real y verificable.

## Specs

- **S1.** Clientes y proveedores escriben en rutas propias, con la misma forma que productos:
  `/dashboard/clients/create`, `/dashboard/clients/[id]/edit`, `/dashboard/clients/[id]/details`,
  `/dashboard/providers/create`, `/dashboard/providers/[id]/edit`.
  Pedido del humano: «Crear /dashboard/providers/create» y «Actualizar /dashboard/providers/[id]/update».
- **S2.** El listado no abre paneles: sólo navega. La edición y el detalle leen por id, así que recargar
  funciona y el link se comparte.
- **S3.** La edición de proveedores no puede leer por id porque el contrato no expone `GET /suppliers/{id}`:
  resuelve el id contra el padrón cacheado, **espera la carga** y avisa «Ese proveedor ya no existe en
  esta empresa» cuando no está.
- **S4.** Los términos y condiciones son el texto legal real, publicado bajo la versión `2026-10-24`
  (la misma fecha que lleva el texto). El registro exige aceptarlos.
- **S5.** Al compartir, el enlace muestra logo, nombre y descripción: Open Graph + Twitter con una tarjeta
  de 1200×630 generada en el build, y `metadataBase` absoluta tomada de `NEXT_PUBLIC_SITE_URL`, luego
  `VERCEL_URL`, luego `http://localhost:3000`.
- **S6.** La landing cierra con un área de contacto que muestra `alexjesus-4856@hotmail.com` como enlace
  `mailto:` y como texto seleccionable.

## Tasks

| ID | Specs | Ruta | Evidencia |
|----|-------|------|-----------|
| T1 | S1, S2 | `feat(web): split customer panels into their own routes` | `33eeb6d` | 
| T2 | S1, S2, S3 | `feat(web): split supplier panels into their own routes` | `04783a7` |
| T3 | S4 | `chore(terms): publish the legal text as version 2026-10-24` | `e0448d2` |
| T4 | S5 | `feat(web): share a real link preview` | `d316b1d` |
| T5 | S6 | `feat(web): offer a contact area on the landing` | `b6c9974` |
| T6 | S5 | `chore(web): use the brand logo in the shell and the tab` | `2878ca2` |

## Log

- **L1.** «Hay que hacer lo mismo con proveedores. Crear /dashboard/providers/create. Actualizar
  /dashboard/providers/[id]/update». La ruta quedó como `[id]/edit`, igual que productos y clientes: dos
  nombres para la misma acción en el mismo producto es deuda. Si se quiere `update` literal, se mueve la
  carpeta y el `push`.
- **L2.** «Ya esta listo los terminos y condiciones con el texto legal». El texto se publicó tal cual y la
  versión dejó de decir `borrador`: el modal muestra lo que la persona aceptó.
- **L3.** «Cuando se comparta la app salga el logo de la app el nombre y la descripción en la miniatura».
  La primera tarjeta renderizada tenía el pie encimado a la descripción; se resolvió con tres bandas
  (header / centro con `flex:1` / pie) y tipos menores. Verificado mirando el PNG que produce el build.
- **L4.** «Agrega una area de contacto. Colocas mi correo alexjesus-4856@hotmail.com».
- **L5.** Hallazgos de revisión nativa, todos informativos y no bloqueantes: `review-7959f6efdc93f5e0`
  (clientes, 7) y `review-ae7426cf438e155c` (proveedores, 3), ambos **approved** y con su
  acknowledgement ejecutado. `review-8917bfff122e04db` (términos + miniatura + contacto) se aprobó con
  tier **high** y sin hallazgos.
- **L6.** Rarezas del facade anotadas: el candidato de todo el branch muere en
  `lens_context_budget_exceeded` (sólo se revisa por rebanadas) y el par de lentes
  `readability`+`reliability` devuelve `lenses-invalid` aunque un lente solo se acepte.
