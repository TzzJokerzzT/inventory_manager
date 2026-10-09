import {
	check,
	email,
	type GenericSchema,
	minLength,
	object,
	pipe,
	safeParse,
	string,
} from "valibot";

export type LoginValues = { email: string; password: string };
export type LoginErrors = { email?: string; password?: string };

export type RegisterValues = {
	name: string;
	email: string;
	companyName: string;
	password: string;
};
export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>;

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
	return validate(loginSchema, values) as LoginErrors;
}

/**
 * Register form messages, with the same contract as the login ones: the form
 * renders them as-is.
 */
const REQUIRED_NAME = "Ingresá tu nombre y apellido.";
const REQUIRED_COMPANY = "Ingresá el nombre de tu empresa.";

/**
 * The register form asks for more than the API accepts today: `POST /auth/register`
 * takes only email and password. Name and company are validated anyway because the
 * form needs them and the company is created by the bootstrap MI-44 owns; a field
 * that looks required should behave as required. The password floor matches the
 * API's own rule, so the client never lets through something the server rejects.
 */
const registerSchema = object({
	name: pipe(
		string(),
		check((value) => value.trim() !== "", REQUIRED_NAME),
	),
	email: pipe(
		string(),
		check((value) => value.trim() !== "", REQUIRED_EMAIL),
		email(INVALID_EMAIL),
	),
	companyName: pipe(
		string(),
		check((value) => value.trim() !== "", REQUIRED_COMPANY),
	),
	password: pipe(
		string(),
		check((value) => value.trim() !== "", REQUIRED_PASSWORD),
		minLength(8, SHORT_PASSWORD),
	),
});

/**
 * Validates the register form and returns the messages per field, in the same
 * shape the login form already consumes.
 */
export function validateRegister(values: RegisterValues): RegisterErrors {
	return validate(registerSchema, values) as RegisterErrors;
}

/**
 * Shared issue-to-field mapping. The first message per field wins, so the order
 * of the checks in each schema decides which one a person sees.
 */
function validate(
	schema: GenericSchema<Record<string, unknown>>,
	values: Record<string, unknown>,
): Record<string, string> {
	const result = safeParse(schema, values);
	if (result.success) {
		return {};
	}

	const errors: Record<string, string> = {};
	for (const issue of result.issues) {
		const field = issue.path?.[0]?.key;
		if (typeof field !== "string") {
			continue;
		}

		errors[field] ??= issue.message;
	}

	return errors;
}
