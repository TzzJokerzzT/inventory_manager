import { check, pipe, safeParse, string } from "valibot";

/**
 * The cap the API applies to `fullName`, mirrored here so the form never sends
 * something the server would reject.
 */
export const MAX_FULL_NAME_LENGTH = 120;

/**
 * The messages are part of the contract: the form renders them as-is, so they
 * stay in the UI language of the other auth forms.
 */
const REQUIRED_FULL_NAME = "Ingresá tu nombre completo.";
const TOO_LONG_FULL_NAME = `Usá ${MAX_FULL_NAME_LENGTH} caracteres como máximo.`;

/**
 * Emptiness and length are both measured on the trimmed value, exactly like the
 * server: whitespace around a real name is not part of it, and the 120-character
 * cap counts the trimmed name. `pipe` stops at the first failing check, so an
 * empty value reports the required message instead of the length one.
 */
const fullNameSchema = pipe(
	string(),
	check((value) => value.trim() !== "", REQUIRED_FULL_NAME),
	check(
		(value) => value.trim().length <= MAX_FULL_NAME_LENGTH,
		TOO_LONG_FULL_NAME,
	),
);

/**
 * Validates a full name and returns the message to show, or `null` when it is
 * valid. It is pure and message-only on purpose: the form renders the returned
 * string and decides what to send (`value.trim()`).
 */
export function validateFullName(value: string): string | null {
	const result = safeParse(fullNameSchema, value);
	if (result.success) {
		return null;
	}

	return result.issues[0]?.message ?? null;
}
