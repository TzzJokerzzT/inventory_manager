import * as v from "valibot";

/**
 * Request schema for `POST /companies/:companyId/members`.
 *
 * The email is trimmed here (lowercasing is the domain layer's responsibility,
 * enforced by the Membership entity). The role is constrained to the same
 * union the domain uses, so a malformed role is a 400 at the edge rather
 * than a domain error deeper in the stack.
 */
export const inviteMemberSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "email must not be empty"),
		v.email("email must be a valid email address"),
	),
	role: v.picklist(
		["OWNER", "ADMIN", "MEMBER"],
		"role must be one of OWNER, ADMIN, MEMBER",
	),
});
