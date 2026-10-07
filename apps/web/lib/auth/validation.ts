import {
	check,
	email,
	minLength,
	object,
	pipe,
	safeParse,
	string,
} from "valibot";

export type LoginValues = { email: string; password: string };
export type LoginErrors = { email?: string; password?: string };

/**
 * Field messages. They are part of the contract: the login and register forms
 * show them as-is, so they stay in the UI language and unchanged.
 */
const REQUIRED_EMAIL = "Ingresá tu correo electrónico.";
const INVALID_EMAIL = "Ingresá un correo electrónico válido.";
const REQUIRED_PASSWORD = "Ingresá tu contraseña.";
const SHORT_PASSWORD = "Ingresá una contraseña de al menos 8 caracteres.";

/**
 * The emptiness test is a `check` on the trimmed value rather than a `trim()`
 * step, because trimming the password itself would change what gets sent: a
 * password may legitimately contain spaces. Length, on the other hand, is
 * measured on the raw value.
 */
const loginSchema = object({
	email: pipe(
		string(),
		check((value) => value.trim() !== "", REQUIRED_EMAIL),
		email(INVALID_EMAIL),
	),
	password: pipe(
		string(),
		check((value) => value.trim() !== "", REQUIRED_PASSWORD),
		minLength(8, SHORT_PASSWORD),
	),
});

/**
 * Validates the login form and returns the messages per field.
 *
 * It keeps returning a plain object of messages instead of the parsed values:
 * the forms render it directly, and the same shape is what the register form
 * consumes today.
 */
export function validateLogin(values: LoginValues): LoginErrors {
	const result = safeParse(loginSchema, values);
	if (result.success) {
		return {};
	}

	const errors: LoginErrors = {};
	for (const issue of result.issues) {
		const field = issue.path?.[0]?.key;
		if (field !== "email" && field !== "password") {
			continue;
		}

		// First message per field wins, so the order of the issues decides.
		errors[field] ??= issue.message;
	}

	return errors;
}
