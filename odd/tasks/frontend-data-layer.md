# Capa de datos y estado del frontend (TanStack Query · Valibot · Axios · Zustand)

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: sin clave propia

> **Nota de trazabilidad**: esta tarea **no tiene issue en Jira**. Nace de un pedido directo del
> usuario ("manejar las peticiones y formularios en el frontend"). El stack ya está decidido en
> `docs/stack.md` (Axios, Zustand, TanStack Query, Valibot) y las dependencias **ya están instaladas**
> en `apps/web/package.json`, así que no hay que agregar ninguna. Convendría colgarla de MI-2 o de
> MI-43 en Jira para que quede rastro.

## Objetivo

Dejar la plomería con la que los formularios hablan con la API: **un cliente HTTP** (Axios) con manejo
de errores tipado, **caché de estado de servidor** (TanStack Query), **validación de formularios y de
frontera** (Valibot) y **estado local en memoria** (Zustand) para lo que no es del servidor.

Hoy: los paquetes están instalados pero **no se usan en ningún lado**. `src/providers/providers.tsx`
sólo envuelve `ThemeProvider`; no hay cliente HTTP, ni hooks, ni store.

## Contexto medido

| Verificación | Resultado |
|---|---|
| Dependencias | `@tanstack/react-query ^5.104.1`, `axios ^1.20.0`, `valibot ^1.5.0`, `zustand ^5.0.15` — **ya instaladas** |
| `src/providers/providers.tsx` | Existe y está **sin commitear** (WIP del usuario): sólo `ThemeProvider` |
| `apps/web/.env.example` | **No existe** |
| CORS del API | `app.use(cors())` **sin `credentials: true`** → el navegador no manda ni guarda la cookie `httpOnly` del refresh |
| Validación actual | `lib/auth/validation.ts` con chequeos a mano, **y su test fija los mensajes exactos** |
| Trabajo en paralelo | El usuario está refactorizando `src/features/register/**`, `src/view/Auth/**`, `app/registro/**`, `components/ui/spinner.tsx` y `src/features/login/components/login-form.tsx` |

## Decisión del usuario (2026-10-06)

**Arreglar el CORS ahora**: `WEB_ORIGIN` en el env del API y `cors({ origin, credentials: true })`. Es
la mitad que faltaba de la decisión de la cookie `httpOnly` de MI-52: sin esto el login devuelve el
access token pero el refresh **nunca llega ni se guarda**, y la capa del frontend quedaría a medias justo
donde vive la sesión.

## Reglas de convivencia (no negociables)

- **No tocar** `src/features/register/**`, `src/view/Auth/**`, `app/registro/**`,
  `components/ui/spinner.tsx` ni `src/features/login/components/login-form.tsx`: es WIP del usuario.
- De `src/providers/providers.tsx` (también suyo) se toca **sólo** el mínimo para montar el provider de
  Query, y se reporta la línea exacta.
- **Nunca** `git add -A`: los commits se arman con rutas explícitas.
- Los formularios **no** se cablean acá: se entregan los hooks y el usuario los usa desde sus
  componentes.

## Diseño

- **Cliente HTTP** — `lib/api/client.ts`: instancia de Axios con `baseURL` desde
  `NEXT_PUBLIC_API_URL`, `withCredentials: true` (la cookie del refresh es cross-origin), y un
  interceptor que normaliza los errores del API (`{ error: { message } }`) a un `ApiError` con
  `status` y `message`. Si falta `NEXT_PUBLIC_API_URL` falla con un mensaje claro, no con un
  `localhost` silencioso que en producción apunta a la nada. Vive en `lib/` y no en `src/lib/` porque
  `lib/` ya es el directorio de código compartido de la app (`lib/auth/validation.ts`).
- **TanStack Query** — `src/providers/query-provider.tsx` con `QueryClientProvider` y defaults
  razonables (un `QueryClient` **por render del cliente**, no uno global de módulo: con Next y
  streaming, un cliente compartido entre requests filtra estado entre usuarios). Montado desde
  `src/providers/providers.tsx`.
- **Valibot** — dos usos, distintos y los dos importantes:
  1. **Formularios**: migrar `lib/auth/validation.ts` a esquemas de Valibot **conservando mensajes y
     comportamiento exactos** (su test es el contrato y `register-form.tsx` ya lo importa).
  2. **Frontera**: validar **lo que devuelve el API** con un esquema, en vez de castear la respuesta.
     Un backend que cambia de forma sin avisar debe fallar como error de datos, no explotar en la UI.
- **Zustand** — `src/features/auth/store/session-store.ts`: el **access token en memoria** (nunca en
  `localStorage`: con un XSS eso es la sesión entera), la identidad mínima del usuario y `clear()`.
  El refresh **no** se guarda: vive en la cookie `httpOnly` que maneja el navegador.
- **Hooks de auth** — `src/features/auth/api/{use-login,use-register}.ts` con `useMutation`, el cliente,
  el esquema de frontera y el store. `useRegister` apunta a `POST /auth/register`, que **todavía no
  existe** (MI-53, bloqueada por un requisito del tenant): el hook queda listo y se declara.

## Tareas

- [x] **T1 — CORS con credenciales.** ✅ `WEB_ORIGIN` en `env.ts` (validada como **origen http(s)**, no como URL
  absoluta: `new URL` acepta `localhost:3000` con protocolo `localhost:` y path `3000`, y un origen con
  path nunca coincide con lo que manda el navegador), inyectada en `buildApp` desde el composition root
  y `cors` con `credentials: true` que **responde sólo el origen configurado** (con la forma de función,
  no con el string: así no le anuncia el origen permitido a cualquiera). `.env.example` y `.env`
  actualizados. Commit `44d4d2a`.
- [x] **T2 — Env del front y cliente Axios.** ✅ `apps/web/.env.example` + `lib/api/client.ts` con
  `withCredentials`, interceptor que normaliza a `ApiError` (mensaje del API, mensaje genérico si no
  hay, error de red sin status, y **cancelado se re-lanza tal cual** para que React Query lo ignore),
  factory + acceso perezoso. Commit `7ae496a`.
- [x] **T3 — Provider de Query.** ✅ `QueryProvider` con el cliente creado **dentro del componente**
  (uno por montaje, no un singleton de módulo que filtraría caché entre usuarios) y defaults comentados.
  Montado en `src/providers/providers.tsx`. Commit `7ae496a`.
- [x] **T4 — Valibot.** ✅ `lib/auth/validation.ts` migrado a Valibot **sin tocar su contrato**: el test
  existente (6 casos) pasa sin modificarse y el `register-form.tsx` del usuario sigue funcionando.
  `lib/api/schemas.ts` valida la respuesta de login en la frontera y falla con un `ApiError` legible
  sin filtrar el payload. Commit `64edd98`.
- [x] **T5 — Store de sesión (Zustand).** ✅ `src/features/auth/store/session-store.ts`: sólo el access
  token, **en memoria**; el refresh queda en la cookie `httpOnly` y hay un test que afirma que no se
  escribe nada en `localStorage`/`sessionStorage`. Commit `64edd98`.
- [x] **T6 — Hooks de auth.** ✅ `useLogin` (posta, valida la frontera y guarda el token) y
  `useRegister` (cableado, **documentado como no usable hasta MI-53**, sin inventar contrato).
  Commit `64edd98`.
- [x] **T7 — Tests.** ✅ **192 tests** en el repo (72 api + 120 web al cerrar T3; **131** en web tras
  T4–T6). Cobertura nueva: CORS (origen permitido, origen ajeno, preflight), `WEB_ORIGIN` (sin scheme,
  con path, válido, requerido en producción), cliente (mensaje del API, sin mensaje, red, cancelado,
  éxito, falta de env), provider (render y cliente por montaje), esquemas (forma válida, token ausente,
  tipo incorrecto, sin filtrar payload), store (set/clear/sin persistencia) y `useLogin` (éxito, error
  del API, respuesta con forma inesperada).
- [ ] **T8 — Documentación.** En curso: `docs/stack.md`, `README.md` y este doc.

## Fuera de alcance

Cablear los hooks dentro de los formularios del usuario (los usa él), el `POST /auth/register` real
(MI-53), el contrato OpenAPI (MI-43), el switch de empresa (EMP-04, MI-4/MI-48) y el refresh automático
del access token (MI-54, que es quien define el endpoint de refresh).

## Bitácora

- 2026-10-06 — Documento creado. Medido: dependencias ya instaladas, `providers.tsx` es WIP del usuario,
  no hay `.env.example` en web, y el CORS del API no permite credenciales. Decisión del usuario:
  arreglar el CORS ahora.
- 2026-10-06 — **T1–T7 hechas** (commits `44d4d2a`, `7ae496a`, `dfbe20f`, `538d1f2`, `64edd98`).
- 2026-10-06 — **Dos delegaciones murieron a mitad de camino** (una sin escribir nada, otra dejando
  `WEB_ORIGIN` en `.env.example` pero sin leerlo en `env.ts`). Ante eso hice la unidad yo, en vez de
  gastar una tercera ronda. Lección: con el canal de subagentes inestable, una unidad de 7 archivos
  conviene hacerla directo y no partirla más de lo necesario.
- 2026-10-06 — **Hallazgo: `bun run check-types` fallaba por culpa de Next, no del código.** Con
  `next dev` corriendo, el tsconfig incluye `.next/types` **y** `.next/dev/types`, y el
  `validator.ts` que genera el dev server importa `AppRoutes` desde un `routes.d.ts` que **no exporta**
  ese tipo (sólo `ParamsOf`), así que `tsc` falla sobre archivos generados que el camino de build y
  typegen **no produce** (por eso CI y `next build` están sanos). Aislado con un probe: excluyendo ese
  directorio, `tsc` sale verde. Editar el tsconfig de la app **no se sostiene** (`next typegen`
  re-agrega la entrada), así que el chequeo usa `tsconfig.check.json` con la exclusión.
- 2026-10-06 — **Metí la pata y lo corregí**: el commit `7ae496a` incluyó `src/providers/providers.tsx`,
  que es WIP del usuario y que importa un `./theme-provider` sin versionar → el árbol commiteado no
  compilaba en un clon nuevo. Se destrackeó en `538d1f2` (el archivo sigue en disco, intacto). **Regla**:
  montar un provider en un archivo de WIP ajeno requiere decidir si se commitea el archivo o no; acá lo
  correcto era no commitearlo.
- 2026-10-06 — **Hallazgo menor**: `apps/web/.gitignore` (la plantilla de Next) ignora `.env*` y un
  `.gitignore` anidado **gana** sobre la negación de la raíz, así que `.env.example` no se podía
  versionar. Se agregó la negación ahí, igual que en la raíz para `apps/api`.
- 2026-10-06 — **Trampa de Node que costó un test**: `process.env.X = undefined` guarda la **cadena**
  `"undefined"`, que es *truthy*, así que no dispara un fail-fast. En tests hay que usar `delete`.
