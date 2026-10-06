# Feature: Vista Login (MI-19)

**Estado:** completado (1 criterio declarado como no cumplido: validación en servidor)
**Cierre Jira:** `Done` — comentario `10038`, transición `31`
**Fuente:** Jira MI-19 — `Vista: Login` (subtarea de MI-17, `To Do`, asignada a Alexis Buelvas)
**Diseño fuente:** `Login · Desktop` (1440×900), página `02 · Mockups` de `design/inventory-manager.fig`
**Preview:** `design/exports/03-login.png`
**Requerimientos:** AUTH-01, AUTH-02, AUTH-03, AUTH-05 (`docs/Project.md`)

## Objetivo

Implementar la vista de inicio de sesión en `apps/web` como ruta `/login`, fiel al mockup
`Login · Desktop`, reutilizando los componentes del design system de MI-18, con validación de cliente
y estados de foco y error visibles.

## Alcance

- ✅ **Dentro:** la ruta `/login`, un componente `Checkbox` que falta en el design system, la
  validación de cliente, los estados de foco y error, accesibilidad, tests y verificación visual.
- ❌ **Fuera (decidido con el usuario):** `apps/api`. No se implementa ningún endpoint de
  autenticación ni validación de servidor en esta tarea.
- ❌ **Fuera:** el registro (MI-22), el resto de las vistas de MI-17, el cableado de Auth0 (MI-39).

## Bloqueo que motivó el alcance

MI-19 pide "validación en cliente **y servidor**", pero **no existe servidor de autenticación**:

| Pieza | Estado verificado (2026-10-05) |
| --- | --- |
| Tenant / SPA / audience de Auth0 | no configurado — `AUTH0_DOMAIN` y `AUTH0_AUDIENCE` comentadas en `apps/api/.env.example`; `env.ts` sólo lee `PORT` y `NODE_ENV` |
| `@auth0/auth0-react` en `apps/web` | no instalado |
| `express-oauth2-jwt-bearer` en `apps/api` | declarado en `package.json`, sin cablear (`grep` sin resultados en `src/`) |
| **MI-39 — Configurar Auth0** | `To Do`, y su decisión pendiente "determina si las pantallas de Login/Registro del diseño se implementan tal cual" (`docs/stack.md` §5.4) |

El stack decidido es Auth0 como proveedor de identidad y el backend **valida** el JWT, nunca lo emite.
MI-39 tiene abierto si el login se hace con **Universal Login** (redirect, con la UI de Auth0 — en ese
caso la vista del mockup no existe) o con **formulario propio** contra la API de Auth0.

**Decisión del usuario:** implementar **sólo la vista** y declarar el criterio de validación en
servidor como incumplido en el cierre de MI-19, en vez de inventar un endpoint o bloquear la tarea
hasta MI-39.

## Decisiones de implementación

1. **`Checkbox` se agrega al design system.** El mockup tiene un checkbox "Recordarme" y MI-18 no
   construyó ninguno. Va en `apps/web/components/design-system/checkbox.tsx` con su test y su export
   en el barrel, en vez de improvisarlo dentro de la página.
2. **Los enlaces secundarios no apuntan a rutas inexistentes.** `Crear cuenta` apunta a `/registro`
   (que MI-22 va a construir; hoy daría 404 y queda documentado como referencia hacia adelante).
   `¿Olvidaste tu contraseña?` es un `button` estilizado como enlace, porque AUTH-04 lo provee Auth0
   y está explícitamente fuera del alcance de desarrollo (`docs/stack.md` §5.4).
3. **El submit válido muestra un aviso provisional explícito**, no un éxito falso ni un error de red
   simulado: al validar bien, la vista informa que el proveedor de identidad no está configurado y
   que depende de MI-39. Sin esto, un submit válido no tendría ninguna respuesta observable.
4. **Mínimo de contraseña: 8 caracteres.** Es la política por defecto de Auth0 y se marca como
   provisional hasta que MI-39 confirme la política real del tenant.
5. **Responsive mínimo:** por debajo de `lg` el panel de marca se oculta y el formulario se centra.
   El mockup es sólo desktop (1440×900) y la vista responsive dedicada es MI-23.

## Tareas

### T1 — `Checkbox` en el design system

- [x] **T1.1** `apps/web/components/design-system/checkbox.tsx`: `<input type="checkbox">` nativo con
      `appearance-none`, caja de `size-5` con radio 6 px, `border-border` / `bg-surface` sin marcar y
      `bg-primary` / `border-primary` marcado, ícono `Check` de `lucide-react` visible sólo cuando está
      marcado (patrón `peer`), anillo de foco con el token `primary`.
- [x] **T1.2** Label real asociado con `htmlFor`/`id` y `useId()` cuando no se pasa `id`; el label
      entero debe ser clickeable.
- [x] **T1.3** Export en `apps/web/components/design-system/index.ts` y test en `__tests__/`.
- [x] **T1.4** Sin colores hardcodeados y sin pasos fraccionarios de espaciado (los tests de MI-18 lo
      verifican automáticamente).

### T2 — Validación de cliente

- [x] **T2.1** `apps/web/lib/auth/validation.ts` con una función pura
      `validateLogin(values) -> { email?: string; password?: string }` (sin dependencias de React,
      unit-testeable).
- [x] **T2.2** Reglas: correo requerido y con formato válido; contraseña requerida y de al menos
      8 caracteres. Mensajes en español, en segunda persona y accionables.
- [x] **T2.3** Tests de la función pura cubriendo cada regla y los casos límite (vacío, sólo
      espacios, formato inválido, longitud exacta de 8).

### T3 — Ruta `/login` fiel al mockup

- [x] **T3.1** `apps/web/app/login/page.tsx` con `metadata` propia.
- [x] **T3.2** Panel de marca: fondo `sidebar` (oscuro en ambos temas), logo (cuadrado indigo redondeado
      + "Inventory Manager"), titular "Controlá tu inventario en tiempo real", bajada, y los 3 bullets
      de capacidades con punto indigo, más el pie "© 2026 Inventory Manager".
- [x] **T3.3** Formulario: "Iniciar sesión" (H1), bajada, `TextField` de correo, `TextField` de
      contraseña, `Checkbox` "Recordarme", enlace "¿Olvidaste tu contraseña?", CTA primario
      "Ingresar al panel" (`Button` `size="ds"` a ancho completo) y "¿No tenés cuenta? Crear cuenta".
- [x] **T3.4** El layout divide en dos columnas en desktop y colapsa a una sola por debajo de `lg`.

### T4 — Estados de foco y error visibles

- [x] **T4.1** Error por campo: `TextField` con `error`, borde `danger`, `aria-invalid` y
      `aria-describedby` apuntando al mensaje.
- [x] **T4.2** El error se muestra al enviar y se limpia al corregir el campo (no mientras se escribe
      la primera vez).
- [x] **T4.3** Foco visible en todos los controles (borde + anillo `primary`), navegable por teclado.
- [x] **T4.4** Al enviar con errores, el foco va al primer campo inválido.

### T5 — Tests de la vista

- [x] **T5.1** Tests con `@testing-library/react`: labels asociados a los controles, error visible con
      su texto, `aria-invalid` y `aria-describedby` correctos, el foco se mueve al primer campo
      inválido, y el submit válido muestra el aviso provisional.
- [x] **T5.2** Los enlaces "Crear cuenta" y "¿Olvidaste tu contraseña?" existen y tienen el rol y el
      destino esperados.
- [x] **T5.3** El checkbox "Recordarme" es operable por teclado y su label lo activa.

### T6 — Verificación

- [x] **T6.1** `bun test`, `check-types`, `bun run build` y `bunx biome check .` en verde.
- [x] **T6.2** Medición en navegador real con CDP: layout de dos columnas, alto del CTA, colores de
      tokens, y los estados de foco y error.
- [x] **T6.3** Comparación visual contra `design/exports/03-login.png` en modo claro.

### T8 — Desviaciones de fidelidad encontradas por la verificación visual

- [x] **T8.1** El theme toggle global consume 64 px en flujo: la vista mide 964 px en un viewport de
      900, con banda blanca arriba y scroll. Pasar el toggle a posición fija.
- [x] **T8.2** Panel de marca al 50 %; el mockup lo tiene al 43 %.
- [x] **T8.3** Formulario centrado verticalmente; el mockup lo ancla arriba con el H1 al 13,5 % del
      alto.
- [x] **T8.4** El aviso al usuario contenía la clave interna `MI-39`. Reemplazar por copy de usuario y
      mover la procedencia a un comentario de código.
- [x] **T8.5** "¿Olvidaste tu contraseña?" era un `button` sin handler (control muerto). Cablearlo al
      mismo aviso provisional.
- [x] **T8.6** Tests: actualizar el del aviso, agregar el del botón de recuperación y un guard que falle
      si el copy vuelve a contener una clave `MI-\d+`.

### T7 — Cierre en Jira

- [x] **T7.1** Comentario en MI-19 con la evidencia, la decisión de alcance y el criterio de
      validación en servidor declarado como incumplido.
- [x] **T7.2** Transición de MI-19 y verificación del estado final.

## Evidencia

### T6.2 / T6.3 — Verificación visual (la hizo el orquestador, con navegador real)

Método: Chromium 152 headless manejado por CDP a **1440×900** (el tamaño del mockup), light mode vía
`Emulation.setEmulatedMedia`, medición con `getComputedStyle` y `getBoundingClientRect`. El mockup se
midió con ImageMagick (`magick ... txt:-`) fila por fila y columna por columna.

**Lo que coincide con el diseño:**

| Check | Medición |
| --- | --- |
| Columnas | 720 / 720 px |
| CTA | alto **48 px**, `bg` `#4F46E5`, texto blanco 14 px bold, radio **8 px**, padding izq 24 px |
| Inputs | 640×**48 px**, radio 8 px, padding izq 16 px, borde `#E2E8F0` |
| Checkbox | 20 px de alto |
| Link "Crear cuenta" | `#4F46E5`, `href="/registro"` |
| Texto del panel con opacidad | peor caso **8.38:1** (`sidebar-foreground/70` sobre `sidebar`) — AA OK |

**Hallazgo que la verificación visual destapó: el mockup es 1400×875, no 1440×900** como dice la
descripción de MI-19. El CTA mide 48 px de alto, consistente con el design system.

**Desviaciones medidas** (ver T8):

| # | Mockup | Implementación |
| --- | --- | --- |
| Panel de marca | 602/1400 = **43,0 %**, en y=0 | 720/1440 = 50 %, en y=64 |
| Alto de la vista | 875 (= viewport) | **964** en un viewport de 900 |
| H1 del formulario | y=118 de 875 = **13,5 %** | y≈300 (centrado) |
| Aviso al usuario | — | contenía la clave `MI-39` |

### Revisión de código del orquestador

- La opacidad de `sidebar-foreground/80`, `/90` y `/70` en el panel de marca **pasa AA** (8.38:1 en el
  peor caso), medido y no asumido.
- `rounded-[3px]` del cuadrado interno del logo: **excepción decorativa aceptada**, no es un radio de
  componente. No se toca.
- El worker declaró honestamente que **no hubo evidencia RED-first** en esta tanda: implementó y
  testeo en el mismo paso. Es una desviación real de la política test-first y queda registrada.

## Cierre en Jira

| Acción | Evidencia |
| --- | --- |
| Comentario de cierre | `commentId: 10038` en MI-19 |
| Transición | `transitionId: 31`, `statusName: Done` |
| Estado verificado post-transición | `getJiraIssue MI-19` → `status.name: "Done"` |

MI-19 es subtarea de MI-17 (que sigue `In Progress`). MI-20 a MI-28 quedan pendientes.

## Criterio de aceptación declarado como NO cumplido

**Validación en servidor.** No implementada por decisión de alcance acordada con el usuario. MI-19
cierra con este criterio explícitamente incumplido, no con una omisión silenciosa. La dependencia es
**MI-39 (Configurar Auth0)**, cuya decisión abierta —Universal Login por redirección vs formulario
propio contra la API de Auth0— determina si esta vista se implementa tal cual o directamente no existe.

## Desviaciones del flujo ODD

- **Sin commits por work-unit.** El directorio no es un repo git propio (resuelve a `$HOME`), igual que
  en MI-18. Cada tarea cierra con su verificación observada en vez de con un commit.
