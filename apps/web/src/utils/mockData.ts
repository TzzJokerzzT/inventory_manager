/**
 * Leftovers of the sample-data era.
 *
 * The dashboard (MI-6), products (MI-7), movements (MI-8) and customers (MI-11)
 * now read real data from the API, so their sample rows are gone. The only
 * survivor is `formatDate`, a real formatting helper that the member and user
 * views still use; it lives here so this delivery does not move unrelated
 * imports. A later cleanup can move it to a `utils/format-date.ts` module.
 */

export function formatDate(date: Date | string | number) {
	const d = new Date(date);
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}
