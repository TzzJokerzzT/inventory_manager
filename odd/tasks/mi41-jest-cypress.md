# Feature: Configurar Jest y Cypress (MI-41)

**Estado:** en progreso
**Origen:** pedido del usuario — MI-41 `Configurar los tests (Jest/RTL/Supertest/Cypress) + tarea test en turbo.json`
**Canónico de la decisión de herramientas:** `docs/stack.md` §5.5

## Decisiones del usuario (2026-10-06)

1. **Migrar los 137 tests a Jest y eliminar `bun test`.** Un solo runner en todo el repo.
2. **Supertest para la integración del backend, Cypress para el frontend.** Respeta `docs/stack.md` §5.5
   (que ya declara Jest / RTL / Supertest / Cypress) en vez de cambiarla.

Efecto secundario deseable: **después de esta feature, `docs/stack.md` §5.5 pasa a ser verdad.** Hoy
declara Jest y el repo corre `bun test`.

## Estado de partida (verificado)

| | |
| --- | --- |
| Tests actuales | **137** con `bun test`: 26 en `apps/api`, 111 en `apps/web` |
| `apps/web` | `happy-dom` + `@happy-dom/global-registrator` + `bunfig.toml` con preload + `setup-dom.ts` + `bun-test.d.ts` |
| `apps/api` | `supertest` instalado y funcionando (integración de endpoints) |
| `jest` / `cypress` | instalados en `apps/web` **sin usar**; en `apps/api` no están |
| `turbo.json` | sin tarea `test` |
| Matchers de jest-dom | **no se usan** (verificado: cero coincidencias) |

## Obstáculos técnicos identificados

1. **`import.meta.url` en 8 archivos de test.** No existe en CommonJS. Afecta a `tokens.test.ts`,
   `no-hardcoded-colors.test.ts`, `tokens-palette.test.ts`, `css-layers.test.ts` y `spacing-grid.test.ts`.
2. **Imports con extensión `.js` en `apps/api`** (resolución NodeNext). Necesitan un
   `moduleNameMapper` que quite el `.js` para que Jest encuentre el `.ts`.
3. **`"type": "module"` en ambos `package.json`.** Es la fuente de la fricción con el transform de Jest.
4. **Alias `@/` en `apps/web`.** `login-form.tsx` importa `@/components/design-system` y
   `@/lib/auth/validation`, así que los tests que lo renderizan necesitan que Jest resuelva el alias.
5. **`setup-dom.ts` usa top-level `await import`.** No aplica con `testEnvironment: "jsdom"`: se
   reemplaza por completo.
6. **Sin matchers de jest-dom**, así que no hace falta `@testing-library/jest-dom`.

## Estrategia

Por etapas, cada una verificable y con su propio commit. La etapa 1 se elige primero porque es la que
**prueba el patrón de configuración ESM/CJS con el menor riesgo**: `apps/api` no tiene DOM, no usa
`import.meta` y son 26 tests.

### T1 — `apps/api` a Jest

- [ ] **T1.1** Instalar `jest`, `@swc/jest` y `@types/jest` como devDependencies.
- [ ] **T1.2** `apps/api/jest.config.mjs`: transform con `@swc/jest`, `testEnvironment: "node"`,
      `roots: ["<rootDir>/tests"]`, y el `moduleNameMapper` que quita la extensión `.js` de los
      imports relativos.
- [ ] **T1.3** Migrar los 2 archivos de test: sacar `import { describe, expect, it } from "bun:test"`.
- [ ] **T1.4** `"test": "jest"` en `apps/api/package.json`.
- [ ] **T1.5** Verificar: 26 tests en verde, `check-types` limpio, `biome check .` limpio.

### T2 — `apps/web` a Jest

- [ ] **T2.1** Instalar `jest-environment-jsdom` y `@types/jest`.
- [ ] **T2.2** `apps/web/jest.config.mjs` con `next/jest`, `testEnvironment: "jsdom"` y el mapeo del
      alias `@/`.
- [ ] **T2.3** Reescribir `import.meta.url` → `__dirname` en los 8 archivos afectados (mecánico).
- [ ] **T2.4** Migrar los 11 archivos de test: sacar los imports de `bun:test`.
- [ ] **T2.5** Borrar `bunfig.toml`, `setup-dom.ts` y `bun-test.d.ts`; quitar `happy-dom`,
      `@happy-dom/global-registrator` y `bun-types` de las dependencias.
- [ ] **T2.6** `"test": "jest"` en `apps/web/package.json`.
- [ ] **T2.7** Verificar: 111 tests en verde, `check-types` limpio, `biome check .` limpio.

### T3 — Cypress en `apps/web`

- [ ] **T3.1** `apps/web/cypress.config.ts` con `baseUrl` apuntando al dev server y `video` desactivado.
- [ ] **T3.2** Un spec de E2E mínimo que ejerza la vista de login: cargar `/login`, ver los campos,
      enviar vacío y comprobar que aparecen los errores de validación de cliente.
- [ ] **T3.3** Script `test:e2e` en `apps/web/package.json`.
- [ ] **T3.4** Documentar en el README cómo se corre (requiere el dev server levantado).

### T4 — Orquestación y verificación final

- [ ] **T4.1** Tarea `test` en `turbo.json`.
- [ ] **T4.2** Correr `turbo run test` desde la raíz y confirmar que corre las dos apps.
- [ ] **T4.3** Verificación final: los 137 tests en verde con Jest, `biome check .` limpio,
      `check-types` limpio en ambas apps, y el árbol sin `bun test` en ninguna parte.
- [ ] **T4.4** Confirmar que `docs/stack.md` §5.5 dejó de ser aspiracional.

## Decisión técnica

**Transform a CommonJS**, con `@swc/jest` en `apps/api` y `next/jest` en `apps/web`, reescribiendo los
8 `import.meta.url` a `__dirname`.

Motivo: el camino CJS es el bien recorrido. La alternativa —Jest en modo ESM con
`--experimental-vm-modules`— dejaría los tests intactos pero agrega configuración frágil y roces
conocidos entre Jest ESM y `@testing-library/react` con jsdom. El costo de CJS es tocar 8 archivos de
forma mecánica, que es un precio predecible.

## Riesgos

- **La fricción ESM/CJS es el riesgo principal** y es la razón por la que T1 va primero: valida el
  patrón con el caso más simple antes de aplicarlo a los 111 tests con DOM.
- `next/jest` deriva los `paths` del `tsconfig.json`, pero hay que **confirmarlo** y no asumirlo.
- Si el transform de Jest se atasca, el fallback es `ts-jest` en vez de `@swc/jest` en `apps/api`
  (más lento, pero con mejor manejo de tipos).

## Desviaciones del flujo ODD

- **Sin delegación ni review independiente.** El harness de esta sesión quedó inutilizable: el
  repositorio se creó a mitad de sesión (MI-35) y tanto `gentle_review` como el despacho de writers
  fallan con *"Session Git authority or lifecycle changed"*. Por eso el trabajo se hace inline y la
  revisión queda a cargo del PR.

## Evidencia

_se completa etapa por etapa._
