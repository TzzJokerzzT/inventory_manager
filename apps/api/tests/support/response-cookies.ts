/**
 * Normalizes the `set-cookie` response header, which supertest types as
 * `string | string[] | undefined`, into the array shape the cookie assertions
 * index. A single `Set-Cookie` arrives as a bare string, so casting it to an
 * array and indexing would silently read a single character instead of the
 * header.
 */
export function responseCookies(
	header: string | string[] | undefined,
): string[] | undefined {
	if (header === undefined) {
		return undefined;
	}

	return Array.isArray(header) ? header : [header];
}
