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

## Evidencia del tenant (medida hoy)

`POST /oauth/token` con `grant_type=password` → **403 `unauthorized_client`** ("Grant type 'password'
not allowed for the client"). O sea: la aplicación existe y el `client_secret` es válido, pero el grant
sigue apagado. **Después** de habilitarlo, el mismo probe con un usuario inexistente tiene que pasar a
**`invalid_grant`** — eso es lo que distingue "grant apagado" de "credenciales incorrectas", y es la
señal que voy a usar para verificar el cambio.

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

- [ ] **T1 — Puerto + errores.** `application/ports/identity-provider.ts`, `InvalidCredentialsError`,
  `IdentityProviderUnavailableError` y su mapeo en `error-handler.ts` (401 y 503). Superficies:
  `apps/api/src/application/ports/**`, `apps/api/src/domain/errors/**`,
  `apps/api/src/interfaces/http/middlewares/error-handler.ts`.
- [ ] **T2 — Adaptador de Auth0.** Request con todos los parámetros, scope mínimo, timeout, mapeo de
  errores y logging sin contraseña. Superficies: `apps/api/src/infrastructure/auth0/**`.
- [ ] **T3 — Caso de uso + ruta + validación + cookie + rate limit.** Superficies:
  `apps/api/src/application/use-cases/login-with-credentials.ts`,
  `apps/api/src/interfaces/http/{controllers,routes}/**`, `apps/api/src/main.ts`.
- [ ] **T4 — Tests.** Supertest: éxito, credenciales inválidas, email inexistente (mismo body que el
  anterior, comparado), payload malformado, Auth0 caído (503 ≠ 401), rate limit. Unitario del adaptador
  con `fetch` stubbeado: los parámetros exactos que se mandan y que **la contraseña no aparece en la
  salida**. Y un test que capture `console` durante un login exitoso y uno fallido y afirme que la
  contraseña **nunca** se imprime. Superficies: `apps/api/tests/**`.
- [ ] **T5 — Documentación y Jira.** `docs/stack.md` §5.4 (cookie del refresh, scope mínimo, mapeo de
  errores), `README.md` si corresponde, y MI-52 en Jira.
- [ ] **T6 — Verificación.** Contra el tenant real: re-probar el intercambio y confirmar que pasó de
  `unauthorized_client` a `invalid_grant` (grant habilitado). **El login exitoso real no se puede
  verificar hasta que exista un usuario (MI-53)**: queda declarado como límite, no como hecho.

## Fuera de alcance

MI-53 (registro), MI-54 (logout y refresh), MI-55 (store compartido del rate limit), MI-50
(`auth0_sub → user_id` y membership por request), MI-46 (aceptar asignación pendiente). MI-52 no toca
la tabla `users`.

## Bitácora

- 2026-10-06 — Documento creado. Criterios leídos de Jira. Probe del tenant: grant `Password` **todavía
  apagado**. Decisiones del usuario: refresh en cookie `httpOnly`; el usuario habilita los grants.
