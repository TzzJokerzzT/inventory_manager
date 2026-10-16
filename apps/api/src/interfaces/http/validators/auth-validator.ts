import * as v from "valibot";

/**
 * Request schema for `POST /auth/login`.
 *
 * The email is validated for shape only: normalization (`trim()`, no
 * lowercasing) is owned by the login use case, not by the schema. The password
 * floor is **1 on purpose** — requiring 8 here would reject a legitimate short
 * password with a 400 and leak the registration policy. The ceiling only keeps
 * absurd payloads out.
 */
export const loginSchema = v.object({
	email: v.pipe(v.string(), v.email("email must be a valid email address")),
	password: v.pipe(
		v.string(),
		v.minLength(1, "password must not be empty"),
		v.maxLength(256, "password must be at most 256 characters"),
	),
});

/**
 * Request schema for `POST /auth/register`.
 *
 * Unlike the login schema, the password floor is **8** here. This is a new
 * account, so the policy belongs to our own rules and can be stated. Applying
 * it before Auth0 is also what makes the uniform response honest: Auth0
 * answers `invalid_signup` for both a duplicate email and a rejected password,
 * so a weak password that reached Auth0 would be indistinguishable from a
 * duplicate and the user would get a "check your email" that never arrives.
 */
export const registerSchema = v.object({
	email: v.pipe(v.string(), v.email("email must be a valid email address")),
	password: v.pipe(
		v.string(),
		v.minLength(8, "password must be at least 8 characters"),
		v.maxLength(256, "password must be at most 256 characters"),
	),
});
