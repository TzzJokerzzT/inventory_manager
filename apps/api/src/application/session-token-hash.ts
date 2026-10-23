import { createHash } from "node:crypto";

/**
 * SHA-256 of the refresh token, hex encoded.
 *
 * The session row stores this digest instead of the token itself, and that is
 * what binds the row to the credential it was issued for: the gate compares the
 * digest of the presented token with the stored one, so a stolen token cannot be
 * paired with somebody else's live session. The digest is not usable as a
 * credential, so a database leak does not hand out sessions.
 */
export function hashRefreshToken(refreshToken: string): string {
	return createHash("sha256").update(refreshToken).digest("hex");
}
