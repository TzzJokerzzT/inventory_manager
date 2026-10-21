/**
 * The last company the user selected, persisted in `localStorage`.
 *
 * The stored payload carries **both** ids on purpose: `companyId` is the
 * selection and `userId` is the reference that says whose selection it is. A
 * browser can be shared by two accounts, and a selection made by one of them
 * must never be restored for the other, so a read for a different user is
 * treated as "nothing stored" and the entry is dropped.
 *
 * Nothing here is a secret: the company id is not an authorization token, and
 * every request is authorized server-side by the membership of the company in
 * the URL. This is a convenience so a reload lands on the company the user was
 * working on.
 */

export const COMPANY_PREFERENCE_STORAGE_KEY =
	"inventory-manager:active-company";

export interface CompanyPreference {
	/** Who made the selection. A read for another user is not a match. */
	userId: string;
	/** The company that user selected last. */
	companyId: string;
}

/**
 * `window.localStorage`, or `undefined` when this is not a browser or the
 * browser refused access (some privacy modes throw on the getter itself).
 */
function storageOrUndefined(): Storage | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

function parsePreference(raw: string): CompanyPreference | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		// A truncated or hand-edited value is not a preference.
		return undefined;
	}

	if (typeof parsed !== "object" || parsed === null) {
		return undefined;
	}

	const { userId, companyId } = parsed as {
		userId?: unknown;
		companyId?: unknown;
	};

	if (typeof userId !== "string" || userId.length === 0) {
		return undefined;
	}
	if (typeof companyId !== "string" || companyId.length === 0) {
		return undefined;
	}

	return { userId, companyId };
}

/**
 * Reads the company `userId` selected last.
 *
 * Returns `undefined` when there is no entry, the payload is malformed, or the
 * entry belongs to **another** user; in the last two cases the unusable entry
 * is removed so it cannot linger and be re-read on every load.
 *
 * It does **not** check that the company still exists or that the user still
 * belongs to it: that is the caller's job, because only the loaded company
 * list can answer it.
 */
export function readCompanyPreference(userId: string): string | undefined {
	const storage = storageOrUndefined();
	if (!storage) {
		return undefined;
	}

	let raw: string | null;
	try {
		raw = storage.getItem(COMPANY_PREFERENCE_STORAGE_KEY);
	} catch {
		return undefined;
	}

	if (raw === null) {
		return undefined;
	}

	const preference = parsePreference(raw);
	if (preference === undefined || preference.userId !== userId) {
		clearCompanyPreference();
		return undefined;
	}

	return preference.companyId;
}

/**
 * Stores the selection together with its owner. A storage that refuses the
 * write (quota, private mode) is not an error worth surfacing: the selection
 * still works for this session, it just will not survive a reload.
 */
export function writeCompanyPreference(
	userId: string,
	companyId: string,
): void {
	const storage = storageOrUndefined();
	if (!storage) {
		return;
	}

	try {
		storage.setItem(
			COMPANY_PREFERENCE_STORAGE_KEY,
			JSON.stringify({ userId, companyId } satisfies CompanyPreference),
		);
	} catch {
		// Best effort: see the doc comment above.
	}
}

/** Removes the stored selection, if the storage allows it. */
export function clearCompanyPreference(): void {
	const storage = storageOrUndefined();
	if (!storage) {
		return;
	}

	try {
		storage.removeItem(COMPANY_PREFERENCE_STORAGE_KEY);
	} catch {
		// Best effort: nothing to recover if the storage refuses.
	}
}
