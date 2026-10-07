# Cableado del formulario de login al API

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-19 (vista) / cierra el frontend de MI-52

## Objetivo

El formulario de login (`apps/web/src/features/login/components/login-form.tsx`) hoy **no llama al API**:
el submit válido sólo muestra el aviso provisional *"La autenticación aún no está disponible"* (que ya es
falso). El backend `POST /auth/login` está hecho y verificado contra Auth0 (MI-52, `Done`), el hook
`useLogin` existe y está testeado, y el store de sesión también. Falta **la última conexión**: que el
formulario use el hook.

**Resultado esperado**: un usuario puede iniciar sesión desde la interfaz; el token queda en el store de
sesión; los errores del API se muestran; y al éxito se lo lleva al destino coherente con el estado de
empresas que ya construimos (MI-48).

## Contexto medido

| Pieza | Estado |
|---|---|
| `features/auth/api/use-login.ts` | ✅ Existe: `post("/auth/login")`, `parseLoginResponse`, `setSession({ accessToken })` |
| `features/auth/store/session-store.ts` | ✅ Existe (en memoria, sin `localStorage`, a propósito) |
| `features/auth/api/get-access-token.ts` | ✅ Existe (el getter que `useLogin` pasa al cliente) |
| `app/sin-empresas/page.tsx` | ✅ Existe con su **regla inversa**: con empresas → `router.replace("/")` |
| `shared/components/AlertMessage.tsx` | ✅ Existe (`variant`: `success` \| `danger` \| `warning`) |
| `register-form.tsx` | ✅ **Referencia de patrón**: `useRegister`, `ApiError.message` → `FALLBACK_ERROR`, alertas |
| `login-form.tsx` | ❌ **No usa `useLogin`**: submit válido → `setNotice(true)` y nada más |

**Bug preexistente en el formulario**: los campos usan `disabled={submitted}`, y `submitted` queda en
`true` para siempre tras el primer submit. O sea que **el formulario se deshabilita solo** después de
cualquier intento. Hoy no se nota porque nunca hubo request; con el cableado hay que pasar a
`disabled={isPending}` y dejar `submitted` sólo para decidir cuándo mostrar los errores de validación.

## Decisiones de diseño

1. **Submit válido → `mutate({ email: values.email.trim(), password: values.password })`.** Se recorta
   el email (el API también lo hace); la contraseña **no** se toca. `useLogin` ya valida la forma de la
   respuesta en la frontera y guarda el token.
2. **`submitted` gatea la validación; `isPending` gatea el formulario.** Los campos y el botón se
   deshabilitan sólo mientras la request está en vuelo. El spinner del botón usa `isPending`.
3. **Error del API**: `error instanceof ApiError ? error.message : isError ? FALLBACK_ERROR : undefined`,
   renderizado con `<AlertMessage variant="danger" title="No pudimos iniciar sesión" />`. Mismo patrón
   que registro, para que las dos pantallas se lean igual.
4. **Éxito → `router.replace("/sin-empresas")`.** Es el **único destino que resuelve los dos casos**:
   sin empresas muestra el estado de bootstrap, y con empresas su regla inversa manda a `/`. Se usa
   `replace` (no `push`) para que el botón atrás no vuelva al formulario ya autenticado. Cuando MI-20
   traiga el dashboard, este destino se revisa: el cambio queda en una línea.
5. **"¿Olvidaste tu contraseña?" queda con un aviso honesto**: la recuperación **no existe** todavía.
   El aviso "la autenticación aún no está disponible" ya es falso y no puede quedar en pantalla; se
   reemplaza por uno específico de recuperación. No se inventa un endpoint.
6. **`AlertMessage` se mantiene** (no se migra a toast): el toast lo está cableando el usuario por su
   cuenta y mezclarlo acá rompería su slice. El formulario usa la pieza que ya existe.

## Fuera de alcance

- **"Recordarme"**: no hay endpoint ni storage decidido. Queda como control sin efecto, ya documentado.
- **Recuperación de contraseña**: no hay endpoint ni historia.
- **`loginSchema` exige mínimo 8 caracteres, pero el API acepta 1..256** (decisión explícita de MI-52
  para no filtrar la política de contraseñas ni rechazar contraseñas legítimas cortas). Es una
  **contradicción real** que puede bloquear el login de un usuario creado directo en Auth0 con
  contraseña corta. Tiene su propio test (`lib/auth/validation.test.ts`), así que alinearlo es un cambio
  de contrato de producto: **se reporta, no se toca acá**.
- MI-54 (refresh al cargar): el access token vive en memoria, así que una recarga pierde la sesión. Es
  la consecuencia conocida y declarada de MI-52.

## Tareas

- [x] **T1 — Tests del formulario (RED).** ✅ En
  `apps/web/src/features/login/__tests__/login-page.test.tsx`: mock de
  `@/src/features/auth/api/use-login` y de `next/navigation` (`useRouter` → `replace`), con la convención
  de `src/features/company/__tests__/sin-empresas-page.test.tsx`. **RED observado**: 6 fallaron / 7
  pasaron / 13 totales, exactamente los 6 casos nuevos (no se llamaba a `mutate`, no se navegaba, sin
  alerta de error, sin fallback, campos deshabilitados tras el submit, sin copy de recuperación).
  **GREEN**: 13/13.
- [x] **T2 — Cableado del submit.** ✅ `useLogin` + `isPending` en `disabled` de campos y botón +
  alerta `ApiError.message`/`FALLBACK_ERROR` + `router.replace("/sin-empresas")` en un `useEffect` sobre
  `isSuccess` (mismo patrón que la regla inversa de `/sin-empresas`). El bug de `disabled={submitted}`
  quedó corregido: `submitted` sólo decide cuándo se muestran los errores de validación.
- [x] **T3 — Copy y constante.** ✅ `FALLBACK_ERROR` en
  `apps/web/src/features/login/utils/constants.ts` y aviso honesto de recuperación (reemplaza el de
  autenticación, que ya era falso).
- [ ] **T4 — Checks, verificación y cierre.** Jest del archivo ✅ 13/13, `check-types` ✅, `biome check` ✅.
  Suite de `apps/web`: **195/196**, con 1 rojo **preexistente y ajeno** (ver T5). Commit de work-unit ✅,
  `gentle_review` assess del candidato en curso.
- [ ] **T5 — BLOQUEANTE (ajeno, no mío): `register-form.test.tsx` está en rojo desde `1ee5dfb`.**
  El commit del slice de toast del usuario cambió `register.mutate({...})` por
  `mutate({...}, { onSuccess })` en `register-form.tsx` pero **no** actualizó la aserción
  `toHaveBeenCalledWith({ email, password })` de `register-form.test.tsx:93`. Fix mínimo de una línea
  (agregar el segundo argumento esperado con `expect.objectContaining({ onSuccess: expect.any(Function) })`)
  en un **work-unit separado**, porque vive en el slice del usuario. **Requiere su decisión**: hasta
  resolverlo, la suite completa no está verde y T4 no se puede cerrar.

## Ruta y presupuesto

- **Ruta**: delegada (`gentle-ai-worker`). Trigger: multi-file write (form + constante + tests).
- **Presupuesto estimado**: ~120–170 líneas autoradas (muy por debajo de las ~400). Un solo work-unit,
  sin encadenado.
- **Test-first**: aplicable (Jest + resultado esperado claro) → RED observado antes de implementar.

## Bitácora

- 2026-10-07 — Documento creado. Exploración medida: `useLogin`, store, `/sin-empresas` y
  `AlertMessage` existen; el formulario no los usa y tiene el bug de `disabled={submitted}`.
- 2026-10-07 — **T1–T3 hechas**, delegadas a `gentle-ai-worker` (trigger multi-file write). RED observado
  antes de implementar (6/13 fallando) y GREEN después (13/13). `check-types` y `biome check` verdes.
  El worker reportó `status: partial` porque la suite completa tiene el rojo ajeno de T5.
- 2026-10-07 — **Hallazgo no tocado**: `loginSchema` exige mínimo 8 caracteres y el API acepta 1..256
  (decisión explícita de MI-52). Puede bloquear el login de un usuario creado directo en Auth0 con
  contraseña corta; tiene su propio test en `lib/auth/validation.test.ts`. Es una decisión de producto,
  no se cambia acá.
