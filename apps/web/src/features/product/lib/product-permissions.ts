import type { Membership, MeResponse } from "@/lib/api/schemas";

export type ProductRole = Membership["role"];

/**
 * Whether the caller may create, edit or delete products.
 *
 * The server is the authority — `manage_products` is ADMIN/OWNER and a MEMBER
 * gets `403 insufficient_role` — and this only decides what the UI offers, so
 * no action is shown that the caller could not complete. It is a pure function
 * on purpose: the rule is testable without rendering the catalogue.
 */
export function canManageProducts(role: ProductRole | undefined): boolean {
	return role === "OWNER" || role === "ADMIN";
}

/**
 * Whether the caller may permanently delete a product from the trash.
 *
 * It is separate from {@link canManageProducts} on purpose: the purge is
 * **irreversible** and the ledger is the audit trail, so the server keeps it
 * OWNER-only (`purge_products`) even though an ADMIN may soft-delete. Like the
 * other rule it only decides what the UI offers — the API is the guard — and an
 * unknown role is treated as "not allowed".
 */
export function canPurgeProducts(role: ProductRole | undefined): boolean {
	return role === "OWNER";
}

/**
 * The caller's role in the active company, read from `GET /me`'s memberships.
 *
 * `undefined` means "not known yet" (no identity loaded, no active company, or
 * no membership in it) and is treated as read-only by
 * {@link canManageProducts} and {@link canPurgeProducts}: the API is the real
 * guard, so the safe default is to offer nothing.
 */
export function roleForCompany(
	me: MeResponse | undefined,
	companyId: string | undefined,
): ProductRole | undefined {
	if (!me || !companyId) {
		return undefined;
	}

	return me.memberships.find((membership) => membership.companyId === companyId)
		?.role;
}
