# Cadena de entrega de la rama `feat/login-register-backend-frontend`

**Estado**: plan de cortes fijado (un solo pase honesto) · **Rama**: `feat/login-register-backend-frontend`
**Estrategia**: `chain_strategy=feature-branch-chain` (elegida por el usuario, 2026-10-07)
**Base de integración verificada**: `production` (`origin/HEAD` → `refs/remotes/origin/production`)
**Punto de partida de la cadena**: `6d5c5d30b7c6e4db363be1948d33c68581123b5e` (`6d5c5d3 feat: finish task MI-35`), merge-base con `production`

## Por qué existe esta cadena

El review nativo del candidato acumulado **no pudo iniciar**: `lens_context_budget_exceeded` en `preflight`,
sin crear autoridad (`mutation_outcome: not_started`). El candidato medido era la rama entera desde el merge-base:
**65 commits, 152 archivos, 11.407 líneas autoradas**. La continuación que indica el proveedor es reducir el
alcance a commits revisables encadenados.

Presupuesto: **~400 líneas autoradas** (adiciones + borrados) por slice. Un slice = un work unit entregable con sus
tests y docs. Los docs de cierre viajan con la unidad que verifican.

**Restricción estructural**: la historia es lineal, así que cada slice tiene que ser un **rango contiguo** de commits
(es el tip de una rama y el base del siguiente). Eso impide reagrupar commits por tema cuando están intercalados.

## Cortes, en orden de PR

| # | Slice | Commits (rango contiguo) | N | Líneas | Base |
|---:|---|---|---:|---:|---|
| 1 | Mapa de pendientes y cierre de MI-35 | `6cb5b9a` | 1 | +20/-18 = **38** | `6d5c5d30` |
| 2 | Validación del entorno (MI-37) | `d925977` | 1 | +307/-11 = **318** | `6cb5b9a` |
| 3 | Migración del runner de tests a Jest (MI-41) | `47cebaa`..`91b2888` | 3 | +286/-104 = **390** | `d925977` |
| 4 | Cypress E2E, turbo y README del repo | `1657cc2`..`2076ee6` | 4 | +127/-11 = **138** | `91b2888` |
| 5 | Esquema Prisma 7, config y scripts (MI-38/51) | `050c13f` | 1 | +622/-2 = **624** ⚠️ | `2076ee6` |
| 6 | Cliente Prisma en el pooler y docs del bloqueo | `cb85237`..`d1f3a75` | 3 | +143/-3 = **146** | `050c13f` |
| 7 | Migración inicial aplicada con CHECK y pg_trgm | `35eccee` | 1 | +227/-21 = **248** | `d1f3a75` |
| 8 | Adaptador Prisma de companies y docs alineados | `58fef79`..`e747e0a` | 2 | +288/-56 = **344** | `35eccee` |
| 9 | Cierre MI-38/MI-51 y aislamiento de tipos de Cypress | `7c22e22`..`9431c86` | 2 | +79/-20 = **99** | `e747e0a` |
| 10 | Validación de tokens contra el JWKS de Auth0 (MI-39) | `4f092a7` | 1 | +576/-47 = **623** ⚠️ | `9431c86` |
| 11 | Docs del ROPG y cierre de MI-39 | `65addd2`..`b485565` | 2 | +72/-81 = **153** | `4f092a7` |
| 12 | CI estricto y cierre de MI-36 | `7303324`..`0e8ef62` | 2 | +288/-32 = **320** | `b485565` |
| 13 | Puerto de identidad y adaptador de Auth0 | `63ca2e1` | 1 | +661/-0 = **661** ⚠️ | `0e8ef62` |
| 14 | POST /auth/login (MI-52) | `d61d541` | 1 | +514/-8 = **522** ⚠️ | `63ca2e1` |
| 15 | Docs y cierre de MI-52 | `5bf0cd4`..`a7ff59f` | 3 | +127/-37 = **164** | `d61d541` |
| 16 | CORS para el navegador | `44d4d2a` | 1 | +191/-4 = **195** | `a7ff59f` |
| 17 | Cliente HTTP, caché de queries y typecheck determinista | `7ae496a`..`538d1f2` | 3 | +335/-14 = **349** | `44d4d2a` |
| 18 | Validación de formularios y sesión en memoria | `64edd98` | 1 | +327/-12 = **339** | `538d1f2` |
| 19 | Docs del data layer y de la verificación de MI-52 | `d14aa50`..`8b7f13d` | 3 | +179/-15 = **194** | `64edd98` |
| 20 | Alta de usuarios en Auth0 con identidad verificada | `14bbdd4` | 1 | +919/-6 = **925** ⚠️ | `8b7f13d` |
| 21 | Registro y gate de email verificado (MI-53) | `e591e31` | 1 | +619/-7 = **626** ⚠️ | `14bbdd4` |
| 22 | Docs y cierre de MI-53 | `546a1e9`..`2e74e41` | 2 | +63/-27 = **90** | `e591e31` |
| 23 | Registro frontend: validación, providers, spinner y vista | `2ac4d08`..`478d565` | 6 | +186/-25 = **211** | `2e74e41` |
| 24 | Feature de registro y su vista | `05733b6` | 1 | +415/-0 = **415** ⚠️ | `478d565` |
| 25 | Vista de registro, disabled en inputs y detalle de utils | `a4f2809`..`7885d45` | 3 | +24/-3 = **27** | `05733b6` |
| 26 | Bootstrap de empresa con dueño (MI-44 + docs) | `d8649eb`..`8cacc79` | 3 | +839/-69 = **908** ⚠️ | `7885d45` |
| 27 | Estado de empresas y switch (MI-48 T1-T2) | `b266e1b` | 1 | +790/-7 = **797** ⚠️ | `8cacc79` |
| 28 | Pantalla sin empresas y guardia (MI-48 T3-T4 + docs) | `a18e233`..`6c4fcac` | 3 | +704/-18 = **722** ⚠️ | `b266e1b` |
| 29 | Componente toast | `c093e20` | 1 | +323/-0 = **323** | `6c4fcac` |
| 30 | Refactor de formularios y provider del toast | `1ac5bee`..`d783eb1` | 3 | +57/-36 = **93** | `c093e20` |
| 31 | AlertMessage y AlertToast compartidos | `8619d3f` | 1 | +50/-0 = **50** | `d783eb1` |
| 32 | Cableado del login al API + docs | `75801a6`..`c17332a` | 2 | +294/-45 = **339** | `8619d3f` |
| 33 | Docs del bloqueo del review nativo | `aca7c85` | 1 | +16/-0 = **16** | `c17332a` |

**33 slices · 11407 líneas autoradas.** Cada PR hijo apunta al branch del padre inmediato; el primero, al tracker.

### Slices por encima del presupuesto

Cada uno contiene un **commit atómico** que por sí solo pasa las 400 líneas. Partirlo exige reescribir historia:

| # | Líneas | Commit que se pasa | Su tamaño | Por qué no se parte |
|---:|---:|---|---:|---|
| 5 | 624 | `050c13f` | 624 | feat(api): add the Prisma 7 schema, config and database scripts |
| 10 | 623 | `4f092a7` | 623 | feat(api): validate bearer tokens against the Auth0 tenant JWKS |
| 13 | 661 | `63ca2e1` | 661 | feat(api): add the identity provider port and the Auth0 adapter |
| 14 | 522 | `d61d541` | 522 | feat(api): expose POST /auth/login through the backend |
| 20 | 925 | `14bbdd4` | 925 | feat(api): sign users up in Auth0 and read their verified identity |
| 21 | 626 | `e591e31` | 626 | feat(api): register accounts and gate login on a verified email |
| 24 | 415 | `05733b6` | 415 | feat(feature): create register feature |
| 26 | 908 | `d8649eb` | 836 | feat(api): give a company an owner at birth |
| 27 | 797 | `b266e1b` | 797 | feat(web): know the user's companies and which one is active |
| 28 | 722 | `a18e233` | 668 | feat(web): offer a way out when the user has no company |

Un solo pase de corte no los puede reducir. Si se quiere que **todos** los slices entren en el presupuesto, la única
vía es **reescribir la historia** en work units de ~400 líneas, lo que invalida los hashes ya commiteados (incluidos
los del slice del usuario). Es decisión del usuario, no del orquestador.

## Mecánica del review por slice

- El candidato nativo del slice *k* es el rango `base..tip` de la tabla, con `committedOnly: true`.
- El review nativo lee el árbol en **HEAD**, así que para revisar el slice *k* el worktree tiene que estar en su tip
  (rama del slice). Un `baseRef` con el árbol completo en HEAD volvería a revisar la rama entera.
- El boundary revisado de cada slice pasa a ser el `baseRef` del siguiente. El primero es `6d5c5d30`.

## Entrega

Por `feature-branch-chain`: un PR **tracker draft sin merge** y cada PR hijo apuntando al branch del padre inmediato
(el primer hijo, al tracker). Cada hijo lleva el diagrama de dependencias con 📍 en el PR actual, y declara inicio,
fin, dependencias previas y fuera de alcance.
**Push, creación de PR y merge son decisión del usuario**; elegir la estrategia no los autoriza.

## Fuera de alcance

- **T5** de `odd/tasks/login-form-wiring.md`: `register-form.test.tsx:93` en rojo desde `1ee5dfb` (slice del usuario).
- `loginSchema` con mínimo 8 caracteres frente al API que acepta 1..256.
- Los huecos funcionales pendientes del plan de Jira (MI-20 dashboard, MI-45, MI-46, MI-47, MI-50, MI-54, MI-55).
