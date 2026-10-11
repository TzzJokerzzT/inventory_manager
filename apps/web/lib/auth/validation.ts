import {
	type BaseIssue,
	type BaseSchema,
	check,
	email,
	forward,
	minLength,
	object,
	partialCheck,
	pipe,
	safeParse,
	string,
} from "valibot";

export type LoginValues = { email: string; password: string };
export type LoginErrors = { email?: string; password?: string };

export type RegisterValues = {
	email: string;
	password: string;
	confirmPassword: string;
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
const CONFIRM_PASSWORD = "Las contraseñas no coinciden.";

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
 * `POST /auth/register` takes only email and password, so those are the only
 * fields validated here, plus the confirmation, which never leaves the client.
 * The password floor matches the API's own rule, so the client never lets
 * through something the server rejects. If the form later asks for name and
 * company (see MI-44), they get added here along with their messages.
 */
const registerSchema = pipe(
	object({
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
		confirmPassword: pipe(
			string(),
			check((value) => value.trim() !== "", REQUIRED_PASSWORD),
		),
	}),
	forward(
		partialCheck(
			[["password"], ["confirmPassword"]],
			(input) => input.password === input.confirmPassword,
			CONFIRM_PASSWORD,
		),
		["confirmPassword"],
	),
);

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
	schema: BaseSchema<unknown, unknown, BaseIssue<unknown>>,
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
