# Plan de trabajo — Inventory Manager

**Generado:** 2026-10-06 · **Fuente:** Jira proyecto `MI` (55 issues) + estado real del repo + `docs/stack.md`
**Estado:** 13 `Done` · 2 `In Progress` · **40 `To Do`**

Este documento es el mapa de lo que falta, ordenado por **dependencia**, no por fase. El roadmap por
fases vive en [`Project.md`](./Project.md#-roadmap--fases); acá está qué bloquea a qué y qué
decisiones faltan tomar.

---

## 1. Bloqueantes absolutos

Sin estos, ninguna otra cosa avanza. Los cinco son de **MI-2** (setup).

| Clave | Qué | Por qué bloquea | Estado real del repo |
| --- | --- | --- | --- |
| ~~**MI-35**~~ ✅ | Control de versiones (Git) | **HECHO (2026-10-06)**: repositorio propio en `TzzJokerzzT/inventory_manager`, ramas `production`, `development` y `feat/login-register-backend-frontend`, 110 archivos versionados. **Desbloqueó MI-36 y MI-42** | ✅ repo propio |
| ~~**MI-38**~~ ✅ | Prisma + Supabase | **HECHO (2026-10-06)**: `schema.prisma` + migración `20261006223356_init` aplicada + adaptador `PrismaCompanyRepository` cableado (`35eccee`, `58fef79`). Verificado por un verificador independiente y cerrado en Jira (comentario `10042`). **Desbloquea MI-3, MI-4, MI-5, MI-44 a MI-51 y la Fase 2** | ✅ schema + migración aplicada + adaptador |
| ~~**MI-39**~~ ✅ | Auth0 | **HECHO (2026-10-06)**: tenant verificado (JWKS + discovery 200), middleware `requireAuth` cableado sobre `/companies` y probado con JWKS local (43 tests), `WWW-Authenticate` en el 401. Cerrada en Jira (comentario `10044`). El grant `Password` y el Application Type quedan a cargo de **MI-52**. **Desbloquea MI-44, MI-46, MI-50, MI-52 a MI-55** | ✅ tenant + validación JWKS cableada |
| **MI-37** | `.env.example` de la raíz | Sin esto no hay onboarding reproducible ni CI que arranque | ❌ no existe |
| **MI-43** | Contrato frontend ↔ backend | Sin tipos compartidos, cada validación se duplica y se desincroniza | ❌ sin definir |

## 2. Decisiones abiertas

Cada una bloquea implementación. **Ninguna es código: son decisiones tuyas.**

| # | Decisión | Bloquea | Nota |
| --- | --- | --- | --- |
| 1 | ~~**Cómo se testean los endpoints protegidos** con Supertest: clave de prueba firmada localmente o stub del middleware de Auth0~~ ✅ **resuelta**: clave de prueba + JWKS local | — | Se elige sobre el stub porque un `issuer`/`audience` mal configurado pasaría la suite sin detectarse |
| 2 | **Store compartido del rate limit**: Vercel KV o Upstash Redis | **MI-55** y **MI-38** | Con ROPG el rate limit del login **no es opcional**; el contador en memoria no limita en serverless |
| 3 | ~~**`pg_trgm`** para búsqueda difusa de productos y clientes: sí o no~~ ✅ **resuelta**: sí, activada en la primera migración | — | `pg_trgm` (1.6) instalada en `20261006223356_init` |
| 4 | ~~**Versión *major* de PostgreSQL**~~ ✅ **resuelta**: **17** (servidor reporta 17.6) | — | Medido en el proyecto aprovisionado |
| 5 | **Renombrar `Mode 1` → `Light`** en la colección de variables del `.fig` | — | MI-17; prolijidad del archivo de diseño |
| 6 | **`Company.owner_user_id` en el `.fig`** | — | El diseño todavía tiene el modelo de dueño único; hay que alinearlo con §5.8 |
| 7 | **El estado "sin empresas" no está diseñado** | MI-48 | El mockup del dashboard asume una empresa ya seleccionada. Lo señala MI-48 |

## 3. Inconsistencias detectadas

Estas no estaban en ninguna tarea y hay que resolverlas antes de que muerdan.

### 3.1 `MI-41` dice Jest, pero el repo ya corre con `bun test`

| Fuente | Dice |
| --- | --- |
| `docs/stack.md` §5.5 | Unitario: **Jest** · integración frontend: RTL · backend: Supertest · E2E: Cypress |
| `apps/api/package.json` | `"test": "bun test"` (y funciona: 4 tests en verde) |
| `apps/web/package.json` | `"test": "bun test"` con `happy-dom` (111 tests en verde, de MI-18/MI-19) |

**Hay que decidir**: migrar a Jest como dice el stack, o quedarse con `bun test` y actualizar
`docs/stack.md` §5.5. Hoy `jest`, `@testing-library/*`, `cypress` y `husky` están declarados en
`apps/web` como `devDependencies` pero **`jest` no se usa**. Supertest y Cypress no tienen conflicto:
son un cliente HTTP y un runner E2E, funcionan con cualquiera de los dos.

### 3.2 El `README.md` estaba desactualizado — **corregido**

Su sección **Pendientes → Decisiones abiertas** listaba la UX de autenticación de Auth0 como
abierta, cuando **se resolvió** el 2026-10-06 (formulario propio mediado por el backend, §5.4), y no
mencionaba ninguna de las 12 tareas nuevas (MI-44 a MI-55). Corregido el 2026-10-06.

### 3.3 `MI-51` cuelga de `MI-2` aunque pertenece a `MI-38`

Jira **no permite anidar subtareas** y MI-38 ya es subtarea de MI-2. El error fue explícito:
`Parent issue ID: '10142' / Key: 'MI-38' can not be sub-task.` Queda bajo MI-2 con una nota.

**Estado (2026-10-06):** el esquema multi-usuario que lleva MI-51 ya está en `schema.prisma` y
**aplicado** en la migración `20261006223356_init` (commit `35eccee`); MI-51 quedó `Done` en Jira
(comentario `10043`). El único follow-up no bloqueante es que el `UNIQUE (user_id, company_id)` no
impide dos invitaciones pendientes para el mismo email y empresa (con `user_id IS NULL` los NULL son
distintos en PostgreSQL), así que MI-46 tiene que decidir explícitamente qué hace con más de una.

## 4. Capas de trabajo por dependencia

### Capa 0 — Setup (MI-2)

MI-35 Git · MI-36 CI · MI-37 `.env.example` raíz · MI-38 Prisma + Supabase · MI-39 Auth0 ·
MI-40 Cloudinary · MI-41 tests · MI-42 Husky · MI-43 contrato OpenAPI · MI-51 esquema Prisma del
acceso multi-usuario.

Dependencias internas: **MI-36 y MI-42 dependen de MI-35**. MI-51 pertenece a MI-38.

### Capa 1 — Autenticación, empresas y aislamiento (Fase 1)

| Padre | Subtareas nuevas | Total |
| --- | --- | --- |
| **MI-3** Autenticación | MI-44 registro + bootstrap · MI-45 asignar con rol · MI-46 aceptar asignación · MI-47 reglas de autorización · MI-48 estado "sin empresas" · MI-52 login (ROPG) · MI-53 register · MI-54 logout · MI-55 rate limiting | 9 |
| **MI-4** CRUD de Empresas | MI-49 invariante del último `OWNER` | 1 |
| **MI-5** Middleware de aislamiento | MI-50 validar membership en cada request | 1 |

**Depende de:** MI-38 y MI-39. Es la capa con más trabajo y la más crítica: MI-50 es el mayor riesgo
de seguridad del proyecto (no hay Row Level Security).

### Capa 2 — Core de inventario (Fase 2)

MI-6 dashboard · MI-7 CRUD de productos · MI-8 entradas y salidas · MI-9 historial de movimientos.
**Vistas asociadas:** MI-20 dashboard, MI-21 listado de productos, MI-25 formulario de producto,
MI-26 movimientos.

### Capa 3 — Clientes y alertas (Fase 3)

MI-10 vinculación de clientes a salidas · MI-11 CRUD de clientes · MI-12 notificaciones de stock bajo
en UI. **Vista asociada:** MI-24 clientes.

### Capa 4 — Polish (Fase 4)

MI-13 notificaciones por email · MI-14 gráficos · MI-15 filtros y búsquedas · MI-16 recuperación de
contraseña. **Vistas asociadas:** MI-23 tablet, MI-27 flujo de navegación, MI-28 modo oscuro.

### Transversal — Diseño (MI-17)

**9 vistas pendientes**: MI-20 a MI-28. MI-18 (Design System) y MI-19 (Login) están `Done`.

## 5. Pendientes que NO están en Jira

| Qué | Detalle |
| --- | --- |
| **El `.fig` sin guardar** | `design/inventory-manager.fig` en disco tiene 28 tokens; el documento vivo de OpenPencil tiene 33. Necesita un `Ctrl+S`. El bridge MCP no puede guardarlo (`RPC_TIMEOUT = 2e4` hardcodeado sobre 224 KB) |
| **`/registro` da 404** | El enlace "Crear cuenta" de MI-19 apunta a `/registro`, que construye MI-22 |
| **El theme toggle flota sobre el login** | `apps/web/app/layout.tsx` lo renderiza en todas las rutas. Es una ayuda de la app, no parte del producto; el mockup no lo tiene |

## 6. Camino crítico

La cadena más corta hasta una app con login funcionando y datos aislados por empresa:

```
MI-35 (Git) ✅ ─┬─> MI-36 (CI)
                └─> MI-42 (Husky)

MI-38 (Prisma) ──> MI-51 (esquema multi-usuario)
                     │
MI-39 (Auth0) ───────┼──> MI-44 (registro) ──> MI-46 (aceptar asignación)
   │                 │
   │                 └──> MI-52 (login ROPG) ──> MI-55 (rate limiting)
   │                                              ↑
   │                            decisión #2 (store compartido)
   │
   └─ decisión #1 (testing de endpoints protegidos) ──> MI-50 (middleware de aislamiento)

MI-4 (empresas) ──> MI-49 (último OWNER)
MI-3 + MI-5 ──────> MI-45 (asignar con rol) ──> MI-47 (reglas de autorización)
```

**Primeros dos pasos recomendados:** la **decisión #1** (cómo se testean los endpoints protegidos) y
**MI-38** (Prisma + Supabase). Sin esos dos, el login y el aislamiento se construyen a ciegas.

**MI-36 (CI) y MI-42 (Husky)** ya están desbloqueados: dependían de MI-35 y MI-35 está hecho.

---

## Resumen por fase

| Fase | Pendientes |
| --- | --- |
| Setup (MI-2) | 9 |
| Fase 1 — Fundamentos | 14 |
| Fase 2 — Core de inventario | 4 |
| Fase 3 — Clientes y alertas | 3 |
| Fase 4 — Polish | 4 |
| Diseño (MI-17) | 9 |
| **Total** | **43** |
