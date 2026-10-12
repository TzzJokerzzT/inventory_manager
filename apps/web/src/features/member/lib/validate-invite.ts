import type { Membership } from "@/lib/api/schemas";

/** A deliberately simple check: a non-empty local part, `@`, and a dotted domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Client-side gate for the invite form, mirroring the API's `format: email`
 * enough to catch the obvious typo before a round-trip. The server still
 * validates; this only avoids a request that would fail.
 */
export function validateInviteEmail(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed === "") {
		return "Ingresá el correo de la persona a invitar.";
	}
	if (!EMAIL_PATTERN.test(trimmed)) {
		return "Ingresá un correo electrónico válido.";
	}
	return null;
}

const ROLE_SET: ReadonlySet<Membership["role"]> = new Set([
	"MEMBER",
	"ADMIN",
	"OWNER",
]);

/** Narrowing helper: keeps a value that came back from a `<select>` typed. */
export function isMemberRole(value: string): value is Membership["role"] {
	return ROLE_SET.has(value as Membership["role"]);
}
