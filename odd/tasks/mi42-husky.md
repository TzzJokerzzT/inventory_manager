# MI-42 — Husky: gates locales antes del CI

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-42 (`To Do`)
**Dependencia**: MI-35 (repo Git propio) ✅ — "ya no tiene bloqueos" (`docs/plan-de-trabajo.md:141`)

## Objetivo

Que el CI deje de ser la **primera** red de seguridad. Hoy `bun run lint` / `check-types` / `test` sólo
corren si alguien se acuerda: en esta misma sesión un archivo mío **pasó los tests y los types e igual
rompió el gate de lint**, y lo commiteó el humano sin que nada lo frenara. Un hook lo habría parado.

**Criterio local** (`README.md:407-410`, el único que existe — el de Jira no es accesible en esta sesión):
correr **lint, typecheck y los tests afectados** en cada commit, y depende de tener repo Git propio.

## Contexto medido

| Pieza | Estado |
|---|---|
| `husky` | ✅ `^9.1.7` pero **sólo en `apps/web`** (`apps/web/package.json:45`) — tiene que vivir en la **raíz** para enganchar hooks del repo |
| `.husky/` | ❌ No existe |
| `prepare` script | ❌ No existe en ningún `package.json` |
| `core.hooksPath` | ❌ No configurado en `.git/config` |
| commitlint / lint-staged | ❌ Ausentes en todo el repo |
| Scripts de raíz | ✅ `lint` = `biome check .`, `check-types` = `turbo run check-types`, `test` = `turbo run test` (`package.json:7-13`) |
| `turbo.json` | ⚠️ Define `build`/`check-types`/`test`/`dev`; **no** define `lint` |

## Decisiones de diseño

1. **husky en la raíz**, no en `apps/web`: un hook es del repositorio, no de una app. Se agrega el
   `prepare` script en el `package.json` de la raíz.
2. **Dos hooks, con el costo donde corresponde**:
   - **`pre-commit`**: `biome check` sobre los archivos **staged** — segundos, y no castiga el commit con
     los ~10 s de la suite.
   - **`pre-push`**: `check-types` + `test` — es el punto donde ya vale la pena pagar el costo completo, y
     es exactamente donde el CI arrancaría.
   Esto es la lectura honesta de "lint, typecheck y los tests afectados": lint y types son baratos y van
   antes; los tests son caros y van en el push.
3. **`HUSKY=0` en el CI**: el workflow ya corre los tres gates; un hook ahí sólo duplica. Además evita que
   un `git commit` dentro de un job dispare hooks.
4. **commitlint queda fuera** (no lo pide ningún criterio local). El historial ya es Conventional Commits
   por convención; si el usuario lo quiere, es una tarea aparte.
5. **`turbo.json` gana la tarea `lint`** si hace falta para el hook por paquete; si el hook corre `biome`
   sobre archivos staged desde la raíz, no hace falta.

## Unidades de trabajo

- [x] **U1 — Hook de pre-commit (lint sobre staged)** + husky en la raíz + `prepare`. ✅ Commit `3cf5bd5`.
  `husky@^9.1.7` se movió de `apps/web` a la raíz con `prepare: "husky"`, y `.husky/pre-commit` corre
  `bunx biome check --staged --no-errors-on-unmatched`. **Spot check del padre**: el hook con set vacío sale
  **0**, `bun run lint` sale 0, y —lo más fuerte— **el hook se ejecutó en un commit real** durante el propio
  commit de la unidad (*"Checked 2 files in 6ms"*). **Assess de RDD**: riesgo `medium`, `reviewDue: false`
  (`under_budget`), plan con `independentVerifier: false` → la verificación propia del writer alcanza.
- [ ] **U2 — Hook de pre-push (types + tests)** + `HUSKY=0` en el CI, con prueba de que ambos hooks **frenan de
  verdad**.

## Hallazgo que justifica una bandera

`biome check --staged` **sale con código 1 cuando procesa cero archivos**, así que sin
`--no-errors-on-unmatched` el hook **bloquearía un commit con nada relevante staged**. Se descubrió probando
los dos casos (con y sin la bandera) y no asumiéndolo; queda comentado en el hook para que nadie lo "limpie".

## Verificación de U1

- **RED**: archivo temporal con un error de formato, sólo él staged, `sh .husky/pre-commit` → **exit 1**.
- **GREEN**: set staged vacío → **exit 0** (*"Checked 0 files"*).
- **Triangulación**: `biome check --staged` solo, sobre set vacío → exit 1; con la bandera → exit 0. Prueba
  que el requisito "no romper cuando no hay nada relevante" depende de esa bandera.
- `bun install --frozen-lockfile` → exit 0, **sin cambios** (confirma que el `bun.lock` editado a mano está en
  la forma canónica de bun).
- El archivo temporal de la prueba **no dejó rastro** en el repo (se movió a `/tmp` y se sacó del índice).
- El hook se disparó solo en el commit real de la unidad: prueba de que está **cableado**, no sólo escrito.

## Fuera de alcance

commitlint · lint-staged como dependencia (si `biome check` sobre staged alcanza) · hooks de `post-checkout`
o `pre-rebase` · cualquier cambio en lo que corre el CI (sólo se le agrega `HUSKY=0`).

## Ruta y presupuesto

Delegada. Es **configuración**, no código de producto: ~40-80 líneas entre `package.json`, `.husky/*` y
`ci.yml`. La verificación real es **ejecutar los hooks** y comprobar que rechazan.
