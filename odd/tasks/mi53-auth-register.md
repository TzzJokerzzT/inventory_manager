# MI-53 — `POST /auth/register` (alta en Auth0 + gate de email verificado)

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-53 (`To Do` → al cerrar)

## Objetivo

El registro es abierto (modelo A, `docs/stack.md` §5.8): cualquiera crea su cuenta. La vista de MI-22
manda el alta a **nuestra API**, y la API crea el usuario en la base de datos de Auth0. Y hay un
invariante que cumplir: **sin el email verificado no se crea la fila en `users`**.

**Criterios de MI-53 (Jira, textuales)**: alta contra Auth0 con email y contraseña; se exige
`email_verified` antes de completar el alta (sin verificar no se crea la fila en `users` ni se habilitan
las asignaciones pendientes); se crea la fila en `users` con `auth0_sub` y `email` (ver MI-44); **errores
uniformes** (no revelar si el email ya está registrado); la contraseña nunca se registra en logs ni se
persiste; rate limiting aplicado; tests con Supertest.

## Todo medido contra el tenant real (2026-10-06)

| Medición | Resultado |
|---|---|
| `POST /dbconnections/signup` (alta nueva) | **200** `{ email, email_verified: false, _id }` |
| `POST /dbconnections/signup` (email repetido) | **400 `invalid_signup`** — *"Invalid sign up"*, sin decir por qué |
| `GET /userinfo` con nuestro access token | **200** `{ sub, email, email_verified }` |
| ID token | trae `email_verified`, pero su **`aud` es el `client_id`**, no nuestra API |
| Usuario de prueba | `email_verified: true` (marcado a mano para poder probar el camino positivo) |
| Login + ruta protegida + cookie del refresh | verificado de punta a punta (MI-52) |

## Decisiones del usuario

1. **El gate se resuelve con `/userinfo` sobre el access token** que ya tenemos, no validando el ID
   token: menos piezas, sin dependencias nuevas y sin una segunda configuración de audience (el `aud`
   del ID token es el `client_id`, así que validarlo exigiría otro validador).

## Diseño

### El alta (uniforme, y con nuestra política)

`POST /auth/register` recibe email y contraseña, valida con **Valibot** (email con formato válido,
contraseña **8..256**) y llama al puerto. La respuesta es **uniforme**: `201` con el mismo cuerpo tanto
si la cuenta se creó como si el email ya existía. `invalid_signup` de Auth0 se mapea a esa misma
respuesta y **se loguea el detalle server-side** — el cliente no se entera, nosotros sí.

**Por qué validamos la contraseña nosotros**: Auth0 devuelve `invalid_signup` tanto para "el email ya
existe" como para "la contraseña es débil", o sea que no se pueden distinguir. Si dejáramos pasar
contraseñas débiles, un rechazo de Auth0 por política sería indistinguible de un email duplicado y el
usuario recibiría un "revisá tu correo" que nunca llega. Con nuestra política aplicada antes, lo que
llegue a Auth0 ya la cumple y el único motivo probable de rechazo es la duplicación.

**Consecuencia declarada**: si la política de Auth0 fuera **más estricta** que la nuestra (por ejemplo,
rechaza contraseñas filtradas), ese rechazo también se vería como la respuesta uniforme. Queda
registrado como riesgo conocido y se ve en el log del servidor.

### El gate y la fila en `users`

Al **iniciar sesión** (MI-52), después de intercambiar credenciales:

1. Se pide la identidad con `/userinfo` usando el access token recién emitido.
2. Si `email_verified` es **false**: **no** se emiten tokens, **no** se crea la fila, y se responde
   **403 con un código propio** (`email_not_verified`). Decirle "verificá tu correo" a alguien que
   acaba de probar su contraseña **no es una filtración**: ya demostró que la cuenta es suya. No se
   emiten tokens a propósito: si se emitieran, nuestras rutas protegidas los aceptarían (sólo validan
   firma, issuer y audience) y el invariante quedaría violado por la puerta de atrás.
3. Si `email_verified` es **true**: se hace *upsert* de la fila en `users` por `auth0_sub` y se devuelven
   los tokens como hoy.

**Detalle que importa**: el email que va a Auth0 **no** se pasa a minúsculas (es la credencial y podría
romper una cuenta registrada con mayúsculas), pero el que se **guarda** sí, porque la migración tiene
`CHECK (email = lower(email))`.

### Capas

- Puerto `IdentityProvider` (ya existe) + dos operaciones: `signUp({ email, password })` y
  `getIdentity(accessToken)`.
- Adaptador `Auth0IdentityProvider`: `/dbconnections/signup` y `/userinfo`, con el mismo criterio que ya
  tiene (timeout, mapeo de errores, **nunca loguear el body ni la contraseña**).
- `User` (entidad de dominio) + puerto `UserRepository` (`upsertFromIdentity`, `findByAuth0Sub`) +
  adaptador Prisma en `infrastructure/database/`, como `PrismaCompanyRepository`.
- Caso de uso del registro + ruta `POST /auth/register` con su limiter.

## Tareas

- [x] **T1 — Puerto y adaptador.** ✅ `signUp` y `getIdentity` en el puerto y en `Auth0IdentityProvider`
  (`/dbconnections/signup` con JSON y `/userinfo` con bearer), con timeout, mapeo de errores y sin loguear
  el body. **Hallazgo del worker**: el endpoint de alta usa la forma `code`/`description` de Auth0, no
  `error`/`error_description` como `/oauth/token` y `/userinfo` — hay dos lectores de error separados
  para no confundirlos. `SignUpRejectedError` con mensaje constante; un `email_verified` ausente se
  trata como **false**. Commit `14bbdd4`.
- [x] **T2 — `User` + `UserRepository` + adaptador Prisma.** ✅ El invariante de minúsculas vive en la
  **entidad** (no en el adaptador), así que un email con mayúsculas es irrepresentable y ningún adaptador
  tiene que recordar el `CHECK`. El upsert va por `auth0_sub` y en la rama de actualización sólo refresca
  el email: el `id` y el `created_at` originales no se tocan. Commit `14bbdd4`.
- [x] **T3 — `POST /auth/register`.** ✅ Valibot con contraseña **8..256** (la política se enuncia acá
  porque es una cuenta nueva, y aplicarla antes de Auth0 es lo que hace honesta la respuesta uniforme),
  limiter propio, y **201 uniforme**: el `SignUpRejectedError` se **traga** a propósito en el caso de uso,
  con un comentario que explica por qué no hay que "arreglarlo". Commit `e591e31`.
- [x] **T4 — Gate en el login.** ✅ Tras el intercambio se lee la identidad con `/userinfo`; si
  `email_verified` es false → **403 con `code: email_not_verified`, sin tokens, sin cookie y sin fila**
  (emitir tokens ahí violaría el invariante: las rutas protegidas sólo validan firma, issuer y
  audience); si es true → upsert desde la identidad del proveedor (no desde el body del request) y se
  devuelven los tokens. El `ApiError` del front ahora también captura el `code`. Commit `e591e31`.
- [x] **T5 — Tests.** ✅ api **103** (eran 93) y web **133**: registro (éxito, rechazo con **cuerpo
  igual** al éxito, payload malformado, contraseña débil, 503, 429, contraseña nunca en logs) y gate
  (sin verificar → 403 sin tokens/cookie y con el repositorio **nunca llamado**; verificado → fila creada
  y tokens; `/userinfo` caído → 503).
- [ ] **T6 — Documentación y Jira.** En curso.
- [x] **T7 — Verificación contra el tenant real.** ✅ Corrida completa: alta nueva → **201**; alta
  repetida → **201 con el cuerpo idéntico** (y el rechazo visible **sólo** en el log del servidor);
  contraseña débil → **400**; login sin verificar → **403 `email_not_verified`** sin cookie; login
  verificado → **200** con cookie y accessToken; y en la base **una sola fila** en `users`, la del
  usuario verificado y con el email en minúsculas (el no verificado **no** creó fila). La fila de prueba
  se borró después y la tabla quedó como estaba.

## Fuera de alcance

El bootstrap de la empresa propia y el estado "sin empresas" (MI-44, MI-48), las asignaciones y roles
(MI-45 a MI-47), la resolución de membership por request (MI-50), el logout y el refresh (MI-54) y el
store compartido del rate limit (MI-55).

## Bitácora

- 2026-10-06 — Documento creado. Todo medido contra el tenant: alta OK, duplicado `invalid_signup`,
  `/userinfo` OK, `email_verified` en true para el usuario de prueba. Decisión del usuario: gate por
  `/userinfo`.
- 2026-10-06 — **T1–T5 y T7 hechas** (commits `14bbdd4`, `e591e31`). La verificación contra el tenant
  pasó completa, incluido el invariante: **el usuario sin verificar no creó fila en `users`**.
- 2026-10-06 — **Usuarios de prueba que quedan en el tenant** (no los puedo borrar sin la Management
  API): `mi53-probe-1791341927184@example.com` (verificado a mano) y `mi53-nuevo-1791347472205@example.com`
  (sin verificar). Conviene borrarlos desde el dashboard cuando ya no hagan falta. La fila
  correspondiente en `users` **sí** se borró, y la tabla quedó vacía como estaba.
