# Feature: Sincronizar Jira y la documentación con el estado real del setup

**Estado:** completado (con 1 paso manual pendiente del usuario)
**Fuente:** pedido del usuario — actualizar MI-2 (Fase 1 · Setup) y MI-17 (Fase 0 · Diseño) en Jira, y
los documentos del repo donde están las actividades pendientes.
**Alcance externo:** escrituras en Jira (project `MI`, cloudId `44077890-4588-43c3-85e3-a78e4ac3674d`).

## Decisiones tomadas con el usuario

- **Subtareas de MI-2: 15** — 6 en `Done` (ya realizadas y verificadas) + 9 pendientes.
- **MI-17:** subir `design/inventory-manager.fig`, verificar, borrar el adjunto `.pen` (id `10033`)
  y dejar un comentario de trazabilidad. El borrado es **permanente**.
- **Git: no se toca.** El usuario se encarga del repo mal enraizado (`$HOME`, 0 commits). Queda como
  subtarea pendiente con el bloqueo documentado.

## Contexto verificado (2026-09-25)

| Check | Resultado |
| --- | --- |
| `bunx biome check .` | 36 archivos, `No fixes applied`, exit 0 |
| `bun test` en `apps/api` | 4 pass / 0 fail |
| `bunx tsc --noEmit` en `apps/api` | exit 0 |
| `.github/` | no existe |
| `.env.example` de la raíz | no existe (solo `apps/api/.env.example`) |
| `.husky/`, `prisma/`, `jest.config*`, cypress | no existen |
| Git | sin repo propio; resuelve a `$HOME`, rama `master`, 0 commits |

Jira: MI-2 = `[Fase 1] Setup del proyecto (backend + frontend)`, In Progress, sin subtareas ni
comentarios, 5 tareas en la description. MI-17 tenía 6 adjuntos, incluido `inventory-manager.pen`
(id `10033`, 204 892 B, `application/zip`) y 2 comentarios que nombran el `.pen`.

**Hallazgo que motivó la actualización de docs:** `README.md` §"Estándares de código" afirmaba que
quedan restos de ESLint y que `format` invoca Prettier — falso desde el bootstrap. §Pendientes no
mencionaba Git ni CI. `docs/stack.md` §6.2 y `docs/Project.md` (Roadmap Fase 1) seguían con los
checkboxes de antes del bootstrap.

## Tareas

### T1 — MI-17: reemplazar el adjunto

- [x] **T1.1** Subido `design/inventory-manager.fig` a MI-17 en dos fases (subida a Atlassian Media
      con token efímero, `fileId 76266646-d300-4ab5-bbd0-9600de5a1bc4`, 224 252 B,
      `application/zip`; luego asociación al issue).
- [x] **T1.2** Verificado en `fields.attachment`: `10051 inventory-manager.fig` 224 252 B presente,
      junto al `10033 inventory-manager.pen` 204 892 B.
- [ ] **T1.3** ⚠️ **Bloqueado: el MCP de Atlassian no expone borrado de adjuntos.** Se buscaron
      operaciones con 6 consultas distintas a `discover` (`delete an attachment from a jira issue`,
      `remove an attachment from a jira issue`, `delete a file attached to a jira issue`,
      `trash or archive a jira issue attachment`, `jira issue attachment`, y la inicial conjunta):
      el catálogo de 299 operaciones solo ofrece `uploadAttachmentToJiraIssue` y
      `downloadJiraIssueAttachment`. **Acción manual del usuario:** borrar
      `inventory-manager.pen` (id `10033`) desde la UI de Jira.
- [x] **T1.4** Comentario de trazabilidad agregado como `commentId 10003` (explica el renombrado, la
      causa del fallo, la diferencia de 204 892 vs 224 252 B y la acción manual pendiente).
- [x] **T1.5** Verificado el estado final de adjuntos y comentarios.

### T2 — MI-2: description y subtareas

- [x] **T2.1** Description de MI-2 reescrita: estado actual del monorepo (con los 3 checks de
      verificación), tooling, puertos, las 5 dependencias entre pendientes, los pendientes menores
      sin subtarea y los documentos relacionados.
- [x] **T2.2** 15 subtareas creadas: `MI-29` … `MI-43`.
- [x] **T2.3** Transicionadas a `Done` (transition `31`): `MI-29`, `MI-30`, `MI-31`, `MI-32`,
      `MI-33`, `MI-34`.
- [x] **T2.4** Verificado por JQL `parent = MI-2 ORDER BY key ASC`: 15 subtareas, 6 en `Done`,
      9 en `To Do`.

### T3 — Documentación del repo

- [x] **T3.1** `README.md`: tabla "Estado del proyecto" (fila de Git + puntero a MI-2), §Estándares de
      código (corregida la afirmación stale de ESLint/Prettier), §Husky (MI-42, depende de MI-35),
      §Variables de entorno (parcialmente configuradas + MI-37), §Pendientes → Bloqueantes (reescrito
      con Git, CI y las claves MI-35 … MI-43) y §Decisiones abiertas (claves agregadas).
- [x] **T3.2** `docs/stack.md`: §5.4 con la clave MI-39 y §6.2 con las claves por punto, la limpieza
      del `package.json` marcada como "sin subtarea propia" y una nota de lo ya resuelto.
- [x] **T3.3** `docs/Project.md`: Roadmap Fase 1 con MI-2, el recuento 6/15, las 9 claves pendientes
      y las dependencias de las otras tres actividades de la fase.
- [x] **T3.4** `odd/tasks/stack-bootstrap.md`: encabezado de "Contexto" marcado como estado de
      partida, tabla «Traslado a Jira (MI-2)» con las 15 claves y nota de que Git lo toma el usuario.
- [x] **T3.5** Verificado: las únicas menciones a ESLint/Prettier que quedan son la corrección de
      `README.md` y las notas históricas; las 15 claves aparecen donde corresponde.

## Evidencia

### MI-17 — adjuntos (estado final)

| id | archivo | tamaño | nota |
| --- | --- | --- | --- |
| `10038`, `10034`, `10035`, `10036`, `10037` | previews `.png` | — | intactos |
| `10051` | `inventory-manager.fig` | 224 252 B | **nuevo**, subido en esta tarea |
| `10033` | `inventory-manager.pen` | 204 892 B | **a borrar a mano** desde la UI |

Comentario agregado: `10003`.

### MI-2 — subtareas

| Clave | Configuración | Estado |
| --- | --- | --- |
| `MI-29` | Estructura de carpetas backend + frontend (monorepo Turborepo) | Done |
| `MI-30` | Linter y formateador de código (Biome) | Done |
| `MI-31` | Entorno de desarrollo local (Bun + Turborepo) | Done |
| `MI-32` | Documentar comandos de inicio en README | Done |
| `MI-33` | Base del backend con Clean Architecture + endpoint de salud | Done |
| `MI-34` | Design system y modo oscuro aplicados en el frontend | Done |
| `MI-35` | Configurar control de versiones (Git) | To Do |
| `MI-36` | Configurar CI (`.github/workflows/`) | To Do |
| `MI-37` | Crear el `.env.example` de la raíz | To Do |
| `MI-38` | Configurar Prisma + Supabase | To Do |
| `MI-39` | Configurar Auth0 | To Do |
| `MI-40` | Configurar Cloudinary | To Do |
| `MI-41` | Configurar los tests + tarea `test` en `turbo.json` | To Do |
| `MI-42` | Instalar Husky (git hooks) | To Do |
| `MI-43` | Definir el contrato frontend ↔ backend (tipos desde OpenAPI) | To Do |

## Notas

- **No se hacen commits:** el proyecto sigue sin repo Git propio (mismo bloqueo que
  `stack-bootstrap.md`). El usuario tomó a su cargo el `git init` (**MI-35**).
- **Sobre el adjunto borrado:** el `.pen` de Jira (204 892 B, 00:12) era una revisión **anterior** al
  `.fig` local (224 252 B, 18:49). El local contiene además la página `04 · Modo oscuro` y los fixes
  v1.1–v1.5, así que el borrado no pierde trabajo.
- **Limitación del MCP confirmada:** no hay operación de borrado de adjuntos de Jira. Es el mismo
  hallazgo que ya estaba anotado para el adjunto `02-dashboard.png` de MI-20. Conviene dejar el
  borrado de adjuntos como paso manual en los flujos que lo necesiten.
