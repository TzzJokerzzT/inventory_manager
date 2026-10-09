# Feature: Input de `full_name` en `/sin-empresas` (+ perfil en `/dashboard/user`)

**Estado:** completado — 2 commits (`bc3122a` refactor + `93e3b68` feature), gate raíz verde
**Fuente:** pedido del usuario (2026-10-09): el usuario se crea sin `full_name` (Auth0 no lo manda), así que hay
que pedírselo en la vista `/sin-empresas`. El usuario refactorizó esa vista a `src` antes de pedir.
**Depende de:** `odd/tasks/user-full-name.md` (backend `PATCH /me` + `GET /me` con `fullName`, commits `b1f48e3`/`4f62b09`),
`odd/tasks/me-endpoint.md`. Rama `feat/login-register-backend-frontend`.

## Objetivo

1. En `/sin-empresas`, si el usuario no tiene `fullName`, se le **pide primero** (bloqueante): sin nombre, no crea empresa.
2. Página de perfil en `/dashboard/user` con el mismo formulario, para corregirlo después.

## Decisiones del usuario (2026-10-09)

1. **Coordinación:** yo commiteo, arrastrando su trabajo. **Mejora aplicada**: en vez de un commit mezclado, su refactor
   entró primero como commit propio (`bc3122a`) y el feature entra separado después. Su `app-shell.tsx` (nav → `/dashboard/user`)
   queda **fuera** de mis commits, es suyo.
2. **Ubicación:** input en `src/features/user/` (su carpeta vacía), NO dentro de `NoCompaniesState` (que vive en
   `features/company/` y mezclaría dominios).
3. **Bloqueante:** el botón/no se muestra la tarjeta de empresa hasta que guarde el nombre.
4. **`/dashboard/user`**: su `app/dashboard/user/page.tsx` vacío rompía el build (`next build` es gate de CI). Decidió que
   **yo la lleno como página de perfil real**.

## Estructura acordada (alineada con el refactor del usuario, que está en vuelo)

```
app/dashboard/user/page.tsx          ← llenado por mí: renderiza UserView
src/view/Dashboard/user-view.tsx     ← DEL USUARIO, sin trackear: renderiza User (no se toca)
src/features/user/components/user.tsx      ← llenado por mí: dueño del formulario
src/features/user/components/full-name-form.tsx    ← nuevo
src/features/user/api/use-me.ts              ← GET /me
src/features/user/api/use-update-full-name.ts ← PATCH /me
src/features/user/lib/validate-full-name.ts  ← validación pura
src/features/auth/sin-empresas/components/sin-empresas.tsx  ← compuerta bloqueante
```

**Coordinación en vivo:** el usuario edita concurrentemente (`app-shell.tsx` modificado, `user-view.tsx` nuevo). El worker
**no** toca esos archivos; el `page.tsx` importa `user-view.tsx` (que entra en el commit del feature por necesidad).

## Decisiones técnicas

1. **Compuerta fail-closed:** si `GET /me` falla, no se sabe si hay nombre → se muestra el formulario (bloquea), nunca la
   tarjeta de empresa sin confirmar. Pendiente → spinner (patrón existente).
2. **Validación de cliente** (espejo del backend): no vacío tras trim, ≤ 120 caracteres. La UI **nunca** envía vacío (el
   borrado vía `null`/`""` existe en la API pero no se ofrece en esta UI).
3. **`use-me` es la única fuente** del estado: después del `PATCH` se invalida `["me"]`, y `sin-empresas` relee → reacciona
   mostrando la tarjeta. Sin estado local duplicado.
4. **El `User` componente y el formulario reusan el mismo path** en `/sin-empresas` y `/dashboard/user`.
5. `lib/api/schemas.ts` gana el parseador de la respuesta de `/me` (mismo patrón que `parseCompany`), con su test en
   `lib/api/schemas.test.ts`. El tipo generado `apps/web/lib/api/openapi.d.ts` **ya** tiene `GET`/`PATCH /me` (regenerado en
   el feature anterior), así que no se toca.

## Tareas

### U1 — Datos: schemas + hooks

- [x] **U1.1** `lib/api/schemas.ts`: parseador tipado de la respuesta de `/me` (identidad + memberships); `schemas.test.ts`.
- [x] **U1.2** `src/features/user/api/use-me.ts`: `useQuery(["me"], GET /me)`.
- [x] **U1.3** `src/features/user/api/use-update-full-name.ts`: `useMutation(PATCH /me)`; onSuccess invalida `["me"]`.
- [x] **U1.4** Tests de ambos hooks (patrón de `src/features/company/api/__tests__/use-create-company.test.tsx`).

### U2 — Formulario

- [x] **U2.1** `src/features/user/lib/validate-full-name.ts` pura (trim, no vacío, ≤120) + tests.
- [x] **U2.2** `src/features/user/components/full-name-form.tsx` con `TextField`/`Button`/`Alert` del design system,
      estados de error, `aria-invalid`/`aria-describedby` (patrón del login) + tests.

### U3 — Perfil en `/dashboard/user`

- [x] **U3.1** Llenar `src/features/user/components/user.tsx`: componente dueño del formulario (encabezado + `FullNameForm`).
- [x] **U3.2** Llenar `apps/web/app/dashboard/user/page.tsx` renderizando `UserView` (que ya existe, del usuario).
- [x] **U3.3** Test del componente `User` y/o de la página.

### U4 — Compuerta bloqueante en `/sin-empresas`

- [x] **U4.1** `sin-empresas.tsx`: conserva el redirect existente; agrega `useMe`; si `fullName` es null → `FullNameForm`,
      si ya existe → `NoCompaniesState`; error de `/me` → formulario (fail-closed); pendiente → spinner.
- [x] **U4.2** Actualizar `src/features/company/__tests__/sin-empresas-page.test.tsx` a la compuerta nueva (mock de `/me`).

### U5 — Verificación y commits

- [x] **U5.1** `bun run test` + `check-types` + `bun run build` (raíz) en verde.
- [x] **U5.2** Verificación independiente (`gentle-ai-verify`) sobre el diff real.
- [x] **U5.3** Commit del feature (incluye `user-view.tsx` del usuario por dependencia del `page.tsx`); su `app-shell.tsx`
      queda sin commitear y fuera.

## Fronteras de coordinación (no negociables)

- **No tocar** `apps/web/src/layout/app-shell.tsx` (edición viva del usuario) ni `apps/web/src/view/Dashboard/user-view.tsx`
  (del usuario) ni `apps/web/app/sin-empresas/page.tsx`/`src/view/Auth/SinEmpresasView.tsx` (ya commiteados).
- Nunca `git add -A`; sólo paths explícitos de este feature.

## Evidencia

### RED observado de verdad (worker)

| Pieza | RED | GREEN |
| --- | --- | --- |
| `parseMeResponse` | 6 failed / 10 passed — `parseMeResponse is not a function` | 16 passed |
| hooks | 2 suites failed, 0 tests — `Cannot find module` | 2 suites / 6 tests |
| `validateFullName` | module not found | 6 tests |
| `FullNameForm`/`User` | module not found | 9 tests |
| Compuerta `/sin-empresas` | **4 failed / 3 passed — la tarjeta se renderizaba en vez del formulario** | 7 tests |

Dos fallos transitorios del worker fueron auto-infligidos (import de valibot, path de mock) y corregidos al instante, no defectos de producto. Se declararon, no se escondieron.

### Gates (raíz, árbol completo)

| Gate | Resultado |
| --- | --- |
| `bun run test` | **exit 0** — api 30/241, web 43/264 |
| `bun run check-types` | **exit 0** |
| `bun run build` | **exit 0** — el gate que estaba rojo por el `page.tsx` vacío; ahora 14 rutas estáticas incl. `○ /dashboard/user` |
| `bun run lint` | **exit 0**, 237 archivos |
| verificación independiente | re-corrida con `TURBO_FORCE=true` para descartar caché: los tres gate exit 0 en ejecución real |

### Verificación independiente (`gentle-ai-verify`) — sin bloqueantes

| # | Qué se verificó | Veredicto |
| --- | --- | --- |
| 1 | Gate fail-closed real (error de `/me` → formulario, nunca la tarjeta; spaces cuentan como sin nombre; spinner; redirect intacto) | **VERIFICADO** — `sin-empresas.tsx:51,53,73` con tests que cubren cada rama (`sin-empresas-page.test.tsx:114,124,133,154,164`) |
| 2 | El formulario nunca envía vacío/null; inválido NO llama a la API | **VERIFICADO** — `full-name-form.tsx:41,52`; test asserta `mutate` no llamado (`:64,74`) |
| 3 | Cadena = scaffold del humano (`page.tsx` importa `UserView` nombrado) | **VERIFICADO** — `page.tsx:2,17`; `app-shell.tsx` diff = 1 línea del nav (del humano); `user-view.tsx` sin cambios de forma |
| 4 | Invalidation `["me"]` real | **VERIFICADO** — `use-update-full-name.ts:27`; el test (`:73-102`) fallaría si se quitara (mock mutable con doble `get`) |
| 5 | `parseMeResponse` fiel al spec | **VERIFICADO** — campo a campo contra `openapi.yaml:486-507`; `role` union; `fullName` nullable; reusa `parseCompany`. Nota: formatos y `maxLength` no se aplican — patrón preexistente, no regresión |
| 6 | a11y | **VERIFICADO** — `aria-invalid`/`aria-describedby` reales (`form-field.tsx:44-45`) assertados (`:61-63`); gap menor: focus sólo assertado en el caso vacío |
| 7 | Copy español / código inglés / sin mezclar dominios | **VERIFICADO** — `NoCompaniesState` sólo lo importa la compuerta |
| 8 | Sin drift | **VERIFICADO** — `git ls-files | grep .next/` → 0 |
| 9 | Gates | todos exit 0 en ejecución real (cache-bypassed) |
| 10 | Huecos | la página `/dashboard/user` no tiene test; el re-read post-PATCH sólo a nivel hook; focus con too-long sin assertar |

### Hallazgos abiertos (no bloqueantes)

| ID | Severidad | Hallazgo |
| --- | --- | --- |
| W1 | No bloqueante | La página `/dashboard/user` (render de `UserView`) **no tiene test**. La cadena queda cubierta hasta el componente `User`. |
| W2 | No bloqueante | El re-read end-to-end después del `PATCH` (form → invalidation → compuerta muestra tarjeta) sólo está verificado a nivel de hook, no en la página. |
| W3 | Trivial | Focus en el campo inválido sólo se asserta para el caso vacío, no para too-long. |

### Cierre

| Commit | Contenido |
| --- | --- |
| `bc3122a` | `refactor(web): move the sin-empresas view under src` — el refactor del usuario, commit propio y separado |
| `93e3b68` | `feat(web): collect the full name during the no-company onboarding` — hooks, form, perfil, compuerta, schemas (+ `user-view.tsx` del usuario, que el `page.tsx` importa) |
| _(este commit)_ | `docs(odd): ...` |

**Coordinación respetada:** el `app-shell.tsx` del usuario (nav → `/dashboard/user`) quedó **sin commitear y fuera** de mis commits, igual que el resto de su trabajo. Mis commits usaron siempre paths explícitos.