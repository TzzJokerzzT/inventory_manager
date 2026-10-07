import type { MembershipRole } from "../entities/membership.js";

/**
 * The actions the authorization matrix (docs/stack.md §5.8, `:596-605`) rules
 * on. Member-management endpoints (assign, promote, demote) are MI-45/MI-47 and
 * do not exist yet, so this stays a pure predicate: no HTTP or repository
 * import belongs in this file.
 */
export type AuthorizationAction =
	| "assign_member"
	| "assign_admin"
	| "assign_owner"
	| "change_own_role"
	| "leave"
	| "create_company"
	| "view_users";

/**
 * Pure authorization matrix.
 *
 * It maps `(role, action) -> boolean` with the exact rows of
 * `docs/stack.md:596-605`. The two rows that are easy to forget are first-class
 * here, not a comment:
 *
 * - nobody changes their own role, not even the OWNER (`change_own_role`);
 * - leaving is allowed for anyone except the last active OWNER (`leave`). The
 *   "last active OWNER" fact is a membership count, not a role, so it is the
 *   one extra argument the predicate accepts; every other call is the plain
 *   `can(role, action)`.
 *
 * The `isLastActiveOwner` argument is fail-closed on purpose: it defaults to
 * `true` ("assume this is the last OWNER") so that omitting it can only deny,
 * never grant. A company with no active OWNER is an unrecoverable state
 * (§5.8, invariant 4), so the burden of proof is on the caller to pass `false`
 * when there really is another active OWNER. Do not "simplify" this back to a
 * permissive default.
 */
export function can(
	role: MembershipRole,
	action: AuthorizationAction,
	isLastActiveOwner = true,
): boolean {
	switch (action) {
		case "assign_member":
			// "Assign someone to a company" and "assign or remove a MEMBER"
			// share the same rule: ADMIN or OWNER of that company.
			return role === "ADMIN" || role === "OWNER";
		case "assign_admin":
		case "assign_owner":
			return role === "OWNER";
		case "change_own_role":
			return false;
		case "leave":
			// Anyone may leave, except the last active OWNER: a company can
			// never be left ownerless (§5.8, invariant 4). An OWNER is only
			// allowed to leave when the caller proves this is not the last
			// OWNER (`isLastActiveOwner === false`).
			return role !== "OWNER" || !isLastActiveOwner;
		case "create_company":
		case "view_users":
			// "Create a company" is open to any authenticated user and "view
			// users" is scoped to one's own companies by the query, not by
			// role, so neither discriminates between roles here.
			return true;
	}
}
