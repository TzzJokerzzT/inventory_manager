# Fixes del review RDD sobre el formulario de registro

**Estado**: implementación verificada · **Rama**: `feat/login-register-backend-frontend` · **Origen**: escalación del lineage `review-746ca22040aae326` (target `sha256:82272190…b77983`)

## Objetivo

Cerrar los **tres findings válidos** que dejó la revisión por lentes del candidato del formulario de registro, sin tocar el comportamiento observable de la UI ni el contrato del API. Los findings CRITICAL que dispararon el stop terminal fueron verificados como **falsos positivos** (los lentes leyeron el árbol base como si fuera el candidato) y **no** se "arreglan": no hay nada que arreglar.

**Resultado esperado**: misma conducta observable, una sola fuente de verdad para la regla de contraseña y sin código muerto; las suites de `register-form` y `validation` siguen verdes.

## Findings que sí se atacan

| ID | Severidad | Qué |
| --- | --- | --- |
| `R2-002` | WARNING | `isPasswordValid` en `lib/auth/validation.ts` duplica la regla del schema (`check` + `minLength`): segunda fuente de verdad que puede derivar. |
| `R2-003` | SUGGESTION | Línea comentada muerta (`// const [errors, setErrors] = useState(...)`) en `register-form.tsx:29`. |
| `R2-004` | SUGGESTION | `handleSubmit` recalcula `validateRegister(values)` aunque el render ya derivó `allErrors`. |

## Decisiones

1. **`R2-002` — derivar, no duplicar.** Se extrae `passwordSchema` (la regla real: requerida + mínimo 8) y la validez de la contraseña pasa a ser `safeParse(passwordSchema, value).success`. Una sola fuente de verdad; `isPasswordValid` deja de existir como regla paralela. `loginSchema` usa el mismo `passwordSchema`, porque sus reglas eran idénticas.
2. **`R2-003` — borrar la línea comentada.** No aporta historia: el estado derivado de `allErrors` ya explica por qué no hay `useState` de errores.
3. **`R2-004` — reusar `allErrors`.** `handleSubmit` deja de recalcular: el objeto derivado en el render es exactamente el mismo resultado sobre los mismos `values`. Un cálculo por render, no dos.

## Fuera de alcance

- **`R2-001` / `R3-001` (CRITICAL)** y **`R4-001` / `R3-002`**: falsos positivos verificados contra el árbol congelado `de697fe8` (el candidato ya no tiene `name`/`companyName`; el form tiene `noValidate`). No se tocan.
- **`lib/api/openapi-drift.test.ts`**: falla preexistente por el stamp viejo de `openapi.d.ts` tras el trabajo de endpoints de miembros. Ajeno a este cambio.
- **Commit / push / PR**: decisión del usuario (regla de seguridad: no commiteo sin pedido explícito).

## Review RDD (cerrado)

El candidato de este work unit pasó por una transacción nueva, separada del lineage escalado `review-746ca22040aae326`.

- **Línea**: `review-4baff4c61ebf7aa7` · **target**: `sha256:8b26e5a03390b1c12bfb68cab97a8ba0b5a9d57798c2c5e66720b6a050f8245c` · **tier**: high · 4 paths (los 3 de código + este doc) · 169 líneas cambiadas.
- **Resultado**: `approved` (closure sobre el último evento admitido), sin transición de corrección. Acknowledgement ejecutado: autoridad **quemada** (`gentle-ai.review-acknowledged/v1`).
- **Findings informativos** (no bloquean, ninguno reabre el review; trabajo posterior):

| ID | Lente | Ubicación | Severidad |
| --- | --- | --- | --- |
| `R2-001` | readability | `apps/web/lib/auth/validation.ts:36` | WARNING |
| `R2-002` | readability | `apps/web/src/features/auth/register/components/register-form.tsx:66-67` | WARNING |
| `R3-001` | reliability | `apps/web/lib/auth/validation.ts:106` | WARNING |
| `R3-002` | reliability | `apps/web/src/features/auth/register/components/register-form.tsx:106-107` | SUGGESTION |

La entrega sigue la política ordinaria del repo: el review no autoriza commit, push ni PR.

## Tareas

- [x] **T1 — `R2-002`**: extraer `passwordSchema` y derivar la validez con `safeParse` en `apps/web/lib/auth/validation.ts`.
- [x] **T2 — `R2-003`**: borrar la línea comentada muerta en `apps/web/src/features/auth/register/components/register-form.tsx`.
- [x] **T3 — `R2-004`**: reusar `allErrors` en `handleSubmit` (mismo archivo que T2).
- [x] **T4 — Verificación**: `jest lib/auth src/features/auth/register` (17/17), `check-types` limpio, `biome check` limpio; suite completa 263/264 (sólo `openapi-drift`).
