export const ROLE_LABELS: Record<string, string> = {
	OWNER: "Propietario",
	ADMIN: "Administrador",
	MEMBER: "Miembro",
};

/**
 * Roster status labels. `REVOKED` is not shown because the roster never returns
 * it; it stays here so a revoke response that does reach a view is still
 * readable instead of leaking the raw enum.
 */
export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
	ACTIVE: "Activo",
	INVITED: "Invitado",
	REVOKED: "Revocado",
};
