# Feature: Modelo de acceso multi-usuario por empresa

**Estado:** completado (documentación y planificación; la implementación son las subtareas nuevas de Jira)
**Origen:** consulta de diseño del usuario — cómo un admin da acceso a sus empleados sin compartir credenciales
**Canónico:** **`docs/stack.md` §5.8** — esta feature **no duplica** el diseño, lo referencia. Un solo lugar de verdad.

## Objetivo

Especificar el acceso de **varias personas a una misma empresa** (membresías, roles y asignación) y
dejar planificada su implementación en Jira. Hasta ahora el proyecto sólo modelaba la dirección
inversa: EMP-02 dice "un usuario puede administrar múltiples empresas", y nada decía cómo varias
personas acceden a la misma.

## Decisiones del usuario (2026-10-06)

1. Un empleado **puede pertenecer a varias empresas**.
2. **Roles fijos**: `OWNER`, `ADMIN`, `MEMBER` (revisables si el proyecto crece).
3. **Modelo A**: registro **abierto** + pertenencia por asignación. Esto **revierte** su respuesta
   previa de "sólo por invitación", y deja el proyecto más consistente con AUTH-01.
4. **Membresías propias en Postgres**, no Auth0 Organizations. El plan Free de Auth0 lo decide:
   5 organizaciones, sin `Role Management`, sin `Email Workflow`, sin personalizar signup/login.
5. **`email_verified` obligatorio** en Auth0, porque en el modelo A el email es la llave de unión.

## Hallazgos

1. **El proyecto no modelaba membresías.** `docs/Project.md` EMP-01..EMP-05 y `docs/stack.md` §3.2
   sólo cubrían `user → company`. `docs/stack.md` §5.4 reconocía el hueco ("la autorización por
   empresa es código propio") pero no lo especificaba.
2. **`docs/Project.md` contradecía a `docs/stack.md`.** Su bloque de entidades decía
   `User: id, email, password_hash` — cuando `stack.md` §3.2 y §5.4 dicen explícitamente que **nunca**
   se guardan contraseñas ni hashes porque las custodia Auth0. Y `Company: owner_user_id` es
   exactamente el error de modelado que esta feature corrige: un campo de dueño único no tiene lugar
   para roles ni para más de un usuario.
3. **Jira no permite anidar subtareas.** MI-38 ya es subtarea de MI-2, así que la tarea del esquema
   Prisma fue a **MI-2** con referencia a MI-38. El error de la API fue explícito:
   `Parent issue ID: '10142' / Key: 'MI-38' can not be sub-task.`

## Entregables

| Artefacto | Qué |
| --- | --- |
| `docs/stack.md` §5.8 | La especificación canónica: el problema, por qué no Organizations, registro vs invitación, el modelo Prisma, la matriz de autorización, los 4 flujos, las 5 invariantes de seguridad, los casos borde y el super-admin descartado. Más un puntero desde §5.4. |
| `docs/stack.md` §5.4 | Puntero a §5.8, para que quien lea de Auth0 llegue a la decisión de fondo. |
| `docs/Project.md` §6 | **EMP-06 a EMP-10**: varios usuarios por empresa, asignación con rol, aceptación, listado acotado, y la invariante del último OWNER. |
| `docs/Project.md` entidades | `User` sin `password_hash` y con `auth0_sub`; `Company` sin `owner_user_id`; `Membership` agregada. |
| `docs/Project.md` roadmap | Fase 1 con las claves de MI-3, MI-4 y MI-5 y el alcance nuevo. |
| Jira | 8 subtareas nuevas (MI-44 a MI-51). |

## Tareas de Jira creadas

| Clave | Padre | Qué |
| --- | --- | --- |
| MI-44 | MI-3 | Registro abierto con email verificado y bootstrap de empresa propia |
| MI-45 | MI-3 | Asignar un usuario a una empresa con rol (membership en estado `INVITED`) |
| MI-46 | MI-3 | Aceptar la asignación pendiente al registrarse o iniciar sesión |
| MI-47 | MI-3 | Reglas de autorización por rol y endpoints de gestión de miembros |
| MI-48 | MI-3 | Estado "sin empresas" para un usuario recién registrado |
| MI-49 | MI-4 | Invariante: no salir de una empresa siendo el último `OWNER` activo |
| MI-50 | MI-5 | Resolver `auth0_sub → user_id` y validar la membership en cada request |
| MI-51 | MI-2 | Esquema Prisma del acceso multi-usuario (pertenece a MI-38) |

Cada una lleva criterios de aceptación y apunta a `docs/stack.md` §5.8.

## Evidencia

| Check | Resultado |
| --- | --- |
| Sección §5.8 escrita | presente en `docs/stack.md`, con el modelo Prisma y la matriz de autorización |
| Puntero desde §5.4 | presente |
| EMP-06..EMP-10 | presentes en `docs/Project.md` §6 |
| Entidades corregidas | `password_hash` y `owner_user_id` eliminados; `auth0_sub` y `Membership` agregados |
| Roadmap con claves | Fase 1 con MI-3, MI-4 y MI-5 |
| Subtareas en Jira | 8 de 8 creadas y verificadas con `searchJiraIssuesUsingJql` |
| Rechazo de MI-38 | documentado como hallazgo (Jira no anida subtareas) |

## Qué NO se hizo, a propósito

- **No se creó `apps/api/prisma/schema.prisma`.** MI-38 es dueño de ese archivo y el resto del
  esquema (productos, clientes, movimientos) todavía no está diseñado columna por columna. Crearlo
  ahora sería un archivo a medias que MI-38 tiene que completar o reemplazar. El modelo exacto queda
  especificado en `docs/stack.md` §5.8 y la tarea MI-51 lo lleva a `schema.prisma`.
- **No se implementó ningún endpoint ni middleware.** Esta entrega es diseño y planificación; la
  implementación son MI-44 a MI-51.
- **No se tocó el copy de MI-19.** Con el modelo A, "¿No tenés cuenta? Crear cuenta" vuelve a ser
  correcto, así que no hay nada que cambiar.
