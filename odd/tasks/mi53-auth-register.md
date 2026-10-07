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

- [ ] **T1 — Puerto y adaptador.** `signUp` y `getIdentity` en el puerto y en el adaptador de Auth0,
  con mapeo de errores y sin loguear credenciales. Superficies:
  `apps/api/src/application/ports/identity-provider.ts`, `apps/api/src/infrastructure/auth0/**`,
  `apps/api/src/domain/errors/**`.
- [ ] **T2 — Entidad `User` + puerto + adaptador Prisma.** Superficies:
  `apps/api/src/domain/entities/user.ts`, `apps/api/src/domain/repositories/user-repository.ts`,
  `apps/api/src/infrastructure/database/prisma-user-repository.ts`.
- [ ] **T3 — Registro.** Caso de uso + Valibot + ruta `POST /auth/register` + limiter + respuesta
  uniforme. Superficies: `apps/api/src/application/use-cases/register-user.ts`,
  `apps/api/src/interfaces/http/{controllers,routes,validators}/**`, `apps/api/src/main.ts`.
- [ ] **T4 — Gate en el login.** `/userinfo` tras el intercambio; 403 `email_not_verified` si no está
  verificado; *upsert* de la fila si lo está. Superficies:
  `apps/api/src/application/use-cases/login-with-credentials.ts`,
  `apps/api/src/interfaces/http/controllers/auth-controller.ts`, `apps/api/src/main.ts`.
- [ ] **T5 — Tests.** Registro (éxito, email repetido con **mismo cuerpo** que el éxito, payload
  malformado, proveedor caído, contraseña débil con mensaje claro, rate limit, contraseña nunca en
  logs) y gate (no verificado → 403 sin tokens y sin fila; verificado → fila creada y tokens). Con
  proveedor y repositorio falsos.
- [ ] **T6 — Documentación y Jira.** `docs/stack.md` §5.4/§5.8, `README.md` si corresponde, descripción
  de MI-53 y cierre.
- [ ] **T7 — Verificación contra el tenant real.** Alta de un usuario nuevo por el endpoint, login del
  usuario verificado (fila creada en `users`, verificada por `psql`) y el camino no verificado con un
  usuario nuevo sin verificar. Limpiar los usuarios de prueba al final.

## Fuera de alcance

El bootstrap de la empresa propia y el estado "sin empresas" (MI-44, MI-48), las asignaciones y roles
(MI-45 a MI-47), la resolución de membership por request (MI-50), el logout y el refresh (MI-54) y el
store compartido del rate limit (MI-55).

## Bitácora

- 2026-10-06 — Documento creado. Todo medido contra el tenant: alta OK, duplicado `invalid_signup`,
  `/userinfo` OK, `email_verified` en true para el usuario de prueba. Decisión del usuario: gate por
  `/userinfo`.
