export type LoginValues = { email: string; password: string };
export type LoginErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(values: LoginValues): LoginErrors {
	const errors: LoginErrors = {};

	const email = values.email.trim();
	if (!email) {
		errors.email = "Ingresá tu correo electrónico.";
	} else if (!EMAIL_PATTERN.test(email)) {
		errors.email = "Ingresá un correo electrónico válido.";
	}

	if (!values.password.trim()) {
		errors.password = "Ingresá tu contraseña.";
	} else if (values.password.length < 8) {
		errors.password = "Ingresá una contraseña de al menos 8 caracteres.";
	}

	return errors;
}
