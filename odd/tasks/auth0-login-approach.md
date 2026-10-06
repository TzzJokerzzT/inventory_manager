# Feature: Enfoque de autenticación con Auth0 (MI-39)

**Estado:** decisión tomada y planificada; la implementación son las subtareas nuevas de Jira
**Origen:** decisión del usuario sobre la primera decisión abierta de **MI-39**
**Canónico:** **`docs/stack.md` §5.4** — este documento registra la investigación y el plan, no duplica la especificación

## Decisión

**Formulario propio mediado por el backend.** El SPA envía las credenciales a **nuestra API**, y la
API las intercambia con Auth0 **servidor a servidor** con el *Resource Owner Password* grant
(`POST /oauth/token` con `grant_type=password`).

La vista de Login de MI-19 se implementa tal cual, sin cambios.

## La investigación que la motivó

El usuario eligió primero "formulario propio" sin conocer un requisito que cambia el plan. Verificado
en la documentación de Auth0:

| Fuente | Qué dice |
| --- | --- |
| `universal-vs-embedded-login` | *"For web applications, embedded login uses cross-origin authentication **unless you configure a custom domain**."* |
| `cross-origin-authentication` | *"Modern browsers (including Firefox, Safari with ITP, and Chromium-based browsers) **restrict or block third-party cookies by default**... may fail in those browsers."* Y: para que funcione *"use the same top-level domain for your application and Auth0 tenant"*. |
| `pricing` (plan Free) | `Custom Domains: 1`, con la nota *"Custom domains require credit card verification"*. |

**Conclusión:** el embedded login en el navegador **sin custom domain no es viable en producción** —
se rompe en los navegadores que bloquean cookies de terceros, que hoy es el default. Ese requisito
oculto es el que obligó a elegir entre tres caminos.

## Las tres vías evaluadas

| Vía | Preserva el diseño de MI-19 | Requisitos | Veredicto |
| --- | --- | --- | --- |
| **Universal Login con branding** | No (la UI es de Auth0) | ninguno | Descartada: se pierde la vista de MI-19. Y en Free `Customize Signup & Login` no está disponible |
| **Embedded login en el navegador** | Sí | dominio propio + verificación de tarjeta | Descartada: requisito oculto y frágil entre navegadores |
| **ROPG mediado por el backend** ✅ | **Sí** | ninguno extra | **Elegida** |

## Las consecuencias que hay que asumir

No son opcionales, y por eso están en `docs/stack.md` §5.4 y en los criterios de las tareas:

1. **Rate limiting propio en el login.** Auth0 advierte que con ROPG *"some attack protection features
   may fail"*. Nuestra API pasa a ser la superficie de ataque del login. Depende del store compartido
   de **MI-38** (el backend corre en Vercel serverless, el contador en memoria no limita globalmente).
2. **La contraseña transita nuestra función serverless.** Nunca en logs, sólo por TLS.
3. **Errores uniformes**: el login no revela si el email existe.
4. **Sin login social y sin MFA listo.** ROPG no soporta IdP sociales; MFA requiere el flujo API-driven.
5. **Deuda de seguridad consciente.** Auth0 *"does not recommend"* el ROPG y lo permite sólo para
   aplicaciones de primera parte *"absolutely trusted"*. Este es ese caso, pero queda anotado como
   decisión consciente, no como descuido.

## Tareas creadas

| Clave | Padre | Qué |
| --- | --- | --- |
| MI-52 | MI-3 | `POST /auth/login` mediado por el backend (ROPG contra Auth0) |
| MI-53 | MI-3 | `POST /auth/register` (alta del usuario en Auth0) |
| MI-54 | MI-3 | `POST /auth/logout` (AUTH-03) |
| MI-55 | MI-3 | Rate limiting y anti-abuso del login (obligatorio con ROPG) |

## Evidencia

| Check | Resultado |
| --- | --- |
| `docs/stack.md` §5.4 | la decisión reemplaza al "Pendiente de decisión", con las 5 consecuencias |
| `docs/stack.md` §6.2 | el pendiente de MI-39 marcado como resuelto |
| Comentario en MI-39 | `commentId: 10039`, con las implicancias para el alcance de esa tarea |
| Subtareas nuevas | 4 de 4 creadas y verificadas (MI-52 a MI-55) |
| Documentación de Auth0 | 3 páginas verificadas con `fetch_content`; las citas están arriba |

## Qué NO se hizo, a propósito

- **No se implementó ningún endpoint.** Sin tenant de Auth0 provisionado (MI-39 sigue `To Do`) no hay
  credenciales contra las que probar, así que un `/auth/login` ahora sería un stub intestable.
- **No se tocó `apps/api/.env.example` ni `env.ts`.** Las variables `AUTH0_*` son parte del alcance de
  MI-39; agregarlas sin el tenant sería declarar configuración que no existe.
- **No se tocó la vista de MI-19.** Con esta decisión se implementa tal cual, así que no hay cambios.

## Sigue abierto

**La segunda decisión de MI-39**: cómo se testean los endpoints protegidos con Supertest — clave de
prueba o stub del middleware de validación de Auth0.
