import * as v from "valibot";

/**
 * Request schema for `PATCH /companies/:companyId/members/:membershipId`.
 *
 * Only the role is settable here: which membership is named by the path, and
 * who may perform the change is decided by the authorization matrix in the use
 * case, not by anything the client sends. The role is constrained to the same
 * union the domain uses, so an unknown role is a 400 at the edge.
 */
export const updateMemberRoleSchema = v.object({
	role: v.picklist(
		["OWNER", "ADMIN", "MEMBER"],
		"role must be one of OWNER, ADMIN, MEMBER",
	),
});
