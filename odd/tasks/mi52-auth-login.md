# MI-52 — `POST /auth/login` mediado por el backend (ROPG)

**Estado**: in progress · **Rama**: `feat/login-register-backend-frontend` · **Jira**: MI-52 (`To Do` → al cerrar)

## Objetivo

La vista de Login (MI-19) manda email y contraseña **a nuestra API**, y la API las intercambia con
Auth0 **servidor a servidor** (`POST /oauth/token` con `grant_type=password`). Es la materialización de
la decisión de MI-39.

**Criterios de MI-52 (Jira, textuales)**: validar la forma con **Valibot** y llamar a Auth0 con
`client_id`, `client_secret`, `username`, `password`, `audience`, `scope` y el `realm`/`connection`;
devolver access token y refresh token **según el contrato** y **nunca** reenviar la respuesta cruda de
Auth0; **errores uniformes** (credenciales inválidas y email inexistente, mismo código y mismo
mensaje); **la contraseña nunca se registra** en ninguna capa (ni `morgan`, ni el manejador de errores,
ni el logger del dominio); la contraseña no se guarda ni se hashea; rate limiting aplicado; tests con
Supertest de éxito, credenciales inválidas, payload malformado y respuesta uniforme.

## Decisiones del usuario (2026-10-06)

1. **El refresh token vive en una cookie `httpOnly`**, no en el body. El access token vuelve en el JSON
   (el SPA lo usa como `Authorization: Bearer`) y el refresh va en una cookie `httpOnly` + `Secure` +
   `SameSite=Lax`, `Path=/auth`. Un XSS no puede leer la cookie, así que no puede robar la sesión larga.
2. **El usuario habilita los grants ahora** (`Password` y `Refresh Token`) y revisa que el Application
   Type sea *Regular Web Application*. Sin eso, el intercambio real no se puede verificar.

## Evidencia del tenant (medida)

Evolución del probe con los mismos ocho parámetros que manda el adaptador:

| Cuándo | Respuesta | Qué significa |
|---|---|---|
| 2026-10-06 (antes) | **403 `unauthorized_client`** — *"Grant type 'password' not allowed for the client."* | El grant `Password` estaba apagado |
| 2026-10-06 (después de habilitarlo) | **500 `server_error`** — *"Authorization server not configured with default connection."* | **El grant ya está habilitado** (pasamos ese chequeo) y aparece un **requisito de tenant** que faltaba |

**El requisito**: ROPG necesita que el tenant tenga configurado el **Default Directory** (el nombre de
la conexión de base de datos). Verificado en `auth0.com/docs/get-started/tenant-settings`: *"Default
Directory: Name of the default connection to be used for both the Resource Owner Password Flow and
Universal Login Experience"*, y en el centro de soporte de Auth0: *"The Resource Owner Password Flow
relies on a connection that is capable of authenticating users by username and password, so you must
set the default connection for the tenant."* La ruta es **Dashboard → Tenant Settings → Default
Directory** y el valor tiene que ser el nombre exacto de la conexión:
**`Username-Password-Authentication`** (el mismo que ya mandamos como `realm`).

Detalle que sorprende: mandar `realm` **no alcanza**. El soporte de Auth0 lo documenta como "el tenant
usa la conexión del Default Directory en lugar de la específica de la aplicación", o sea que el ajuste
del tenant manda. Alternativa si no se quiere tocar el tenant: `grant_type`
`http://auth0.com/oauth/grant-type/password-realm`, que sí honra el `realm` — pero se descarta porque el
criterio de MI-52 pide `grant_type=password` y porque el Default Directory es el camino documentado.

**Lo que esto dice de nuestro código**: Auth0 devuelve **500** ante una mala configuración del tenant, y
el adaptador lo mapea a `IdentityProviderUnavailableError` → **503**, no a 401. Es el comportamiento
correcto: no es un problema de credenciales del usuario, y mandarlo a "revisá tu contraseña" sería
mentirle.

**Después** de configurar el Default Directory, el mismo probe con un usuario inexistente tiene que
pasar a **`invalid_grant`** — eso prueba grant activo + aplicación confidencial + nuestros ocho
parámetros aceptados. Es la señal que voy a usar para cerrar esta tarea.

**Resultado final (2026-10-06)**: el usuario habilitó el grant y configuró el Default Directory, y el
probe devolvió **403 `invalid_grant` — "Wrong email or password."**. Después se corrió **nuestro
adaptador** contra el tenant real y produjo `InvalidCredentialsError` (mensaje uniforme
`"Invalid credentials"`), con el log conteniendo sólo `invalid_grant — Wrong email or password.`
Sin usuario no se puede ir más allá: el login exitoso llega con MI-53.

## Diseño

### El puerto (hacia adentro)

`apps/api/src/application/ports/identity-provider.ts`:

```ts
export interface IdentityProviderCredentials { email: string; password: string }
export interface IdentityTokens { accessToken: string; refreshToken?: string; expiresIn: number }
export interface IdentityProvider {
  exchangePasswordCredentials(credentials: IdentityProviderCredentials): Promise<IdentityTokens>;
}
```

Va en `application/ports` y no en `domain/repositories` porque el dominio no tiene ningún concepto de
"proveedor de identidad": el caso de uso es quien necesita intercambiar credenciales. El adaptador real
vive en `infrastructure/auth0/`, igual que `PrismaCompanyRepository` vive en `infrastructure/database/`.

### Errores: uniformes para el cliente, distinguibles en el servidor

- `InvalidCredentialsError` → **401** con un mensaje **fijo**. Credenciales incorrectas y email
  inexistente producen el mismo objeto, por construcción: el mensaje no depende de la respuesta de Auth0.
- `IdentityProviderUnavailableError` → **503**. Si Auth0 está caído o hay timeout, devolver 401 sería
  mentirle al cliente y mandarlo a "revisá tu contraseña". Es un error distinto y honesto.
- **Detalle que importa**: Auth0 responde `unauthorized_client` cuando el grant está apagado, y eso
  **no** son credenciales inválidas — es una mala configuración nuestra. Para el cliente se ve igual
  (uniformidad), pero **se loguea server-side el código de Auth0** (`invalid_grant` vs
  `unauthorized_client`) para poder distinguir una configuración rota de un intento fallido. Sin ese
  log, un grant apagado se leería como "todos se equivocan la contraseña".

### El adaptador

`apps/api/src/infrastructure/auth0/auth0-identity-provider.ts`:

- `POST ${issuerBaseURL}oauth/token`, `content-type: application/x-www-form-urlencoded`, con
  `grant_type=password`, `username`, `password`, `client_id`, `client_secret`, `audience`,
  `scope` **explícito y mínimo** y `realm` (la conexión de base de datos de `AUTH0_CONNECTION`).
- **El `scope` explícito es obligatorio, no cosmético**: la documentación de Auth0 dice que si no se
  manda `scope`, el access token sale **con todos los scopes de la API**. Se manda lo mínimo:
  `openid profile email` + `offline_access` (este último es lo que habilita el refresh token).
- **Timeout** con `AbortSignal.timeout` y mapeo a `IdentityProviderUnavailableError`: la API corre como
  función serverless y una llamada colgada consume el límite de la función (`docs/stack.md` §5.2).
- **La contraseña no se loguea nunca**: el adaptador no loguea el body del request ni el objeto de
  credenciales; loguea sólo el código y la descripción del error de Auth0.
- Mapeo: 4xx de Auth0 → `InvalidCredentialsError`; 5xx o fallo de red → `IdentityProviderUnavailableError`.

### El caso de uso y la ruta

- `application/use-cases/login-with-credentials.ts`: recibe `{ email, password }`, delega en el puerto y
  devuelve los tokens. **No** normaliza el email a minúsculas para la llamada a Auth0: el email es la
  credencial, y cambiarla podría romper un usuario registrado con mayúsculas. Sólo hace `trim`.
- `interfaces/http/controllers/auth-controller.ts` + `routes/auth-routes.ts` + `POST /auth/login`.
- Validación con **Valibot**: email con formato válido, contraseña de 1 a 256 caracteres. El mínimo es
  **1** a propósito: exigir 8 en el login rechazaría con 400 contraseñas legítimas más cortas y filtraría
  la política. El máximo evita payloads absurdos.
- Respuesta: `200 { accessToken, expiresIn }` + `Set-Cookie` con el refresh (`httpOnly`, `secure` en
  producción, `sameSite: "lax"`, `path: "/auth"`, `maxAge` con constante nombrada y comentada).
  **Nunca** la respuesta cruda de Auth0.
- **Rate limiting**: un limiter dedicado y más estricto que el global, sobre `/auth/login`, con un
  comentario que diga que **el store compartido es MI-55** (hoy es en memoria, y en serverless el
  contador en memoria no limita globalmente).
- **Supuesto declarado**: `SameSite=Lax` asume que el SPA y la API quedan bajo el **mismo dominio
  registrable** (p. ej. `app.example.com` y `api.example.com`). Si terminan en sitios distintos,
  `Lax` no manda la cookie y hay que pasar a `None` **con protección CSRF** — eso es una decisión de la
  tarea de despliegue, y queda escrito acá para que no se descubra en producción.

## Tareas

- [x] **T1 — Puerto + errores.** ✅ `application/ports/identity-provider.ts` (con el porqué de no ir en
  `domain/repositories`: el dominio no tiene concepto de proveedor de identidad),
  `InvalidCredentialsError` (401, mensaje **constante** para que la uniformidad sea por construcción) e
  `IdentityProviderUnavailableError` (503), mapeados con ramas explícitas en `error-handler.ts` junto a
  las de `DomainError`/`ValiError`, sin tocar las existentes.
- [x] **T2 — Adaptador de Auth0.** ✅ Los ocho parámetros, `scope` mínimo explícito con el porqué,
  `AbortSignal.timeout` de 5 s con el porqué (serverless), mapeo 4xx→401 / 5xx y red→503, y logueo sólo
  del `code`/`description` del proveedor. **Hueco de robustez que encontré y mandé cerrar**: confiaba en
  la forma del 200 de Auth0, así que un 200 sin `access_token`/`expires_in` habría devuelto 200 al
  cliente con el token en `undefined`; ahora se trata como proveedor no disponible.
- [x] **T3 — Caso de uso + ruta + validación + cookie + rate limit.** ✅ `trim` del email sin
  minúsculas (el email es la credencial), Valibot con contraseña 1..256, `POST /auth/login`, cookie
  `httpOnly`/`Secure`(prod)/`SameSite=Lax`/`Path=/auth` con las opciones **inyectadas** desde el
  composition root (para poder testear los dos modos), respuesta de exactamente dos campos y limiter
  dedicado con el comentario de MI-55.
- [x] **T4 — Tests.** ✅ **65 tests de api** (eran 53). Supertest con proveedor falso (nunca Auth0 real):
  éxito, 401 por credenciales inválidas, 401 por email inexistente **comparado por igualdad de body**,
  400 por payload malformado, 503 distinto de 401, 429 por rate limit, sin `Set-Cookie` si no hay
  refresh, y espía de `console` en el endpoint además del que ya había en el adaptador. RED observado
  antes de implementar (404 en la ruta).
- [x] **T5 — Documentación y Jira.** ✅ `docs/stack.md` §5.4 con el intercambio (scope mínimo, errores
  uniformes, contraseña nunca logueada, timeout, rate limit y el supuesto de `SameSite`) y descripción
  de MI-52 reescrita en Jira.
- [x] **T6 — Verificación.** ✅ **Verificado contra el proveedor real, con nuestro adaptador** (no un
  probe suelto): con el grant habilitado, el Default Directory configurado **y la aplicación autorizada
  para la API**, la cadena completa funciona: `POST /auth/login` → **200**; `GET /companies` con ese
  token → **200** (nuestra API lo validó contra el JWKS del tenant); sin token → **401** con
  `WWW-Authenticate`. Los claims del access token traen
  `aud: ["https://inventory-manager-api", "https://dev-…/userinfo"]`, que es lo que hace que
  `requireAuth` lo acepte. Comentario `10047` en Jira.
  **Límite que queda (uno solo)**: el **refresh token**. El token endpoint devuelve
  `scope: "openid profile email"` y `refresh_token` ausente aunque pedimos `offline_access` → falta
  **`Allow Offline Access`** en la API de Auth0. El código hace lo correcto (solo setea la cookie si
  el proveedor devolvió un refresh token, con test), pero la sesión larga todavía no existe.
- **Hallazgo para MI-53**: `/userinfo` **acepta nuestro access token** (HTTP 200 con `sub`, `email` y
  `email_verified`), porque la API lo incluye en el `aud`. Eso significa que el gate de
  `email_verified` se puede implementar con `/userinfo` sobre el token que ya tenemos, **sin validar el
  ID token y sin agregar dependencias**. El ID token también trae `email_verified`, pero usarlo
  obligaría a una segunda validación con `aud = client_id`.

## Fuera de alcance

MI-53 (registro), MI-54 (logout y refresh), MI-55 (store compartido del rate limit), MI-50
(`auth0_sub → user_id` y membership por request), MI-46 (aceptar asignación pendiente). MI-52 no toca
la tabla `users`.

## Bitácora

- 2026-10-06 — Documento creado. Criterios leídos de Jira. Probe del tenant: grant `Password` **todavía
  apagado**. Decisiones del usuario: refresh en cookie `httpOnly`; el usuario habilita los grants.
- 2026-10-06 — **T1–T5 hechas** (commits `63ca2e1` y `d61d541`). El primer intento de delegación murió
  sin dejar archivos escritos, así que partí el trabajo en dos unidades más chicas: puerto + errores +
  adaptador primero, caso de uso + ruta + tests después. Gates de la raíz verdes: **176 tests**
  (65 api + 111 web), `check-types`, `build` y `biome check`.
- 2026-10-06 — **T6 parcial y declarada**: el probe sigue dando `unauthorized_client`, o sea que el
  grant `Password` no está habilitado. **MI-52 queda `In Progress`**, no `Done`: su criterio incluye el
  éxito del intercambio y eso nunca corrió contra el proveedor real. Se cierra cuando el probe pase a
  `invalid_grant` (grant habilitado) y se adjunte esa evidencia; el login exitoso llega con MI-53.
- 2026-10-06 — **El usuario habilitó el grant y el probe avanzó**: pasó de `403 unauthorized_client` a
  **`500 server_error` — "Authorization server not configured with default connection."** O sea que el
  grant ya está y falta el **Default Directory del tenant** (Dashboard → Tenant Settings). Requisito
  verificado en la doc y el soporte de Auth0; el valor es `Username-Password-Authentication`, el mismo
  que ya mandamos como `realm` — que **no alcanza** por sí solo. Se deja escrito en la sección de
evidencia de arriba para no volver a chocar con esto.
