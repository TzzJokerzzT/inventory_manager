const ISO_TIMESTAMP =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Formats the movement's `createdAt` for the history table.
 *
 * Deliberately locale-free, like {@link formatPrice}: `Intl.DateTimeFormat`
 * follows the runtime's ICU data and time zone, which differ between Node
 * (tests) and the browser, so the same movement could render two ways — or the
 * same instant on two machines. Here the date is read straight from the ISO
 * string the API sends, so the output is identical everywhere.
 *
 * A value the contract does not allow is shown raw instead of throwing: a table
 * must not die because one row is malformed.
 */
export function formatMovementDate(createdAt: string): string {
	const match = ISO_TIMESTAMP.exec(createdAt.trim());
	if (!match) {
		return createdAt;
	}

	const [, year, month, day, hours, minutes] = match;
	return `${day}-${month}-${year} ${hours}:${minutes}`;
}
