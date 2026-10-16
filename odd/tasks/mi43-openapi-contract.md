# MI-43 — Contrato OpenAPI entre frontend y backend

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-43 (`To Do`)
**Es un bloqueante absoluto**: `docs/plan-de-trabajo.md:47-48` — *"Sin tipos compartidos, cada validación se
duplica y se desincroniza"*. **MI-4 (CRUD de empresas) depende de MI-43.**

## Objetivo

Publicar el contrato del API como **especificación OpenAPI** y **generar los tipos del frontend desde
ella**, para que la frontera deje de estar escrita dos veces a mano.

## Contexto medido

| Pieza | Estado |
|---|---|
| Herramienta decidida | ✅ `docs/stack.md:114` — backend con **`swagger` + `yamljs`**; `:245` *"el contrato entre ambas es la **especificación OpenAPI** que **produce el backend**"* |
| Recomendación | ✅ `stack.md:713` (6.2) — *"Recomendado: **generar los tipos del frontend desde la especificación OpenAPI**"* |
| Dependencias | ❌ Ni `swagger` ni `yamljs` están en ningún `package.json` ni en `bun.lock` |
| Especificación | ❌ No existe ningún archivo OpenAPI |
| Duplicación actual | ⚠️ Las reglas viven en `apps/api/src/interfaces/http/validators/{auth,company}-validator.ts` (valibot) **y** otra vez en `apps/web/lib/api/schemas.ts` + `apps/web/lib/auth/validation.ts` |

**Superficie viva que el contrato tiene que cubrir hoy** (`routes/index.ts:22`, `auth-routes.ts:8-20`,
`company-routes.ts:15-24`): `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`,
`POST /auth/logout`, `GET /health`, `POST /companies`, `GET /companies`,
`GET /companies/:companyId/context`. Los cuerpos se definen hoy con valibot (`auth-validator.ts`,
`company-validator.ts`).

## Decisiones de diseño

1. **El formato no está decidido en ningún doc** (sólo la herramienta). Decido **especificación escrita a
   mano en YAML** servida con `swagger` + `yamljs`: es lo que `stack.md:114` nombra, `yamljs` existe
   precisamente para cargar YAML, y un documento revisable es más útil como contrato que uno generado
   desde los valibot (que no describen respuestas ni códigos de error).
2. **La especificación cubre la superficie real de hoy**, incluidos los códigos de error que ya son
   contrato: 401 uniforme del login, 403 uniforme del contexto de empresa, 400 de payload malformado, 429
   del rate limit, 503 del proveedor caído. Un contrato que sólo documenta el camino feliz no evita
   duplicar validaciones.
3. **Se sirve desde la API** en una ruta de documentación, y el archivo vive en el repo como fuente de
   verdad.
4. **Generación de tipos para el web** con `openapi-typescript` como script (`bun run` en la raíz o en
   `apps/web`), escribiendo un archivo generado y **commiteado** para que el frontend no dependa de correr
   el generador. El script queda reproducible.
5. **El contrato no reemplaza los valibot de la API**: valibot sigue validando en runtime. Lo que cambia es
   que el **frontend** deja de escribir sus tipos a mano y los deriva de la especificación.
6. **Riesgo declarado: la especificación puede desincronizarse del código.** Se anota como follow-up un
   chequeo que compare las rutas declaradas con las registradas en el router; no se implementa acá para no
   inflar la unidad.

## Unidades de trabajo

- **U1 — La especificación + servirla (delegada, test-first)**: `swagger` + `yamljs`, el YAML cubriendo las
  8 rutas con sus cuerpos y códigos de error, la ruta de documentación, y un test que verifique que el
  documento se carga y que **cada ruta registrada en el router aparece en la especificación**.
- **U2 — Tipos del frontend (delegada)**: `openapi-typescript` como script, el archivo generado, y el
  reemplazo de los tipos escritos a mano en `apps/web/lib/api/schemas.ts` **sólo donde el contrato ya
   alcance** — sin romper la validación de frontera existente.

## Fuera de alcance

Generar la especificación desde el código (code-first) · reemplazar valibot por los tipos generados en la
API · documentar rutas que no existen · el chequeo de sincronización (follow-up anotado) · autenticación de
la ruta de documentación.

## Ruta y presupuesto

Delegada en dos unidades. **Test-first** aplicable en U1. Presupuesto ~250-350 líneas por unidad.
**Límite declarado**: sin acceso a Jira, el criterio de "terminado" es el de los docs locales —
especificación publicada, tipos generados y usados, y las 8 rutas cubiertas.

## Hallazgo post-implementación — el drift guard atrapó un spec inválido

Cuando los endpoints de miembros (`49152ae`) agregaron rutas al spec, el artefacto generado
`apps/web/lib/api/openapi.d.ts` **no se regeneró** y `apps/web/lib/api/openapi-drift.test.ts` quedó rojo.
La causa raíz resultó más profunda que un olvido: **el spec no era YAML válido**.

`apps/api/openapi.yaml:619` tenía

```yaml
description: The revoked membership, with `status: REVOKED`.
```

Un *scalar plano* con `": "` adentro: YAML lo lee como un mapping anidado y `js-yaml`/`redocly`
(el parser que usa `openapi-typescript`) aborta con `bad indentation of a mapping entry`. Por eso el
generador nunca pudo correr y el stamp quedó viejo. **`yamljs`, con el que la API sirve el documento,
es más permisivo y por eso `apps/api/tests/openapi.test.ts` seguía verde**: el bug era invisible desde
el lado del backend.

**Arreglo aplicado**: citar el valor (`description: "The revoked membership, with \`status: REVOKED\`."`)
y regenerar con `bun run openapi:generate`. El diff del artefacto es aditivo (544 líneas, sólo se removió
el stamp viejo).

**Follow-up anotado (no implementado)**: el test de contrato de la API debería **validar el YAML con un
parser estricto** además de cargarlo con `yamljs`, para que un spec malformado falle en el backend y no
sólo al intentar regenerar. Es el mismo tipo de drift que este contrato existe para prevenir, un nivel
más abajo.
