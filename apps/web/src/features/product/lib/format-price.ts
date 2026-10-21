/**
 * Formats the contract's decimal string (`"1500.00"`) for display.
 *
 * Deliberately locale-free: `Intl.NumberFormat` follows the runtime's ICU data,
 * which differs between Node (tests) and the browser, so the same price could
 * render two ways. Here the grouping and the decimal separator are fixed to the
 * es-AR convention the rest of the UI uses, and the cents come from the string
 * itself — no float ever touches the value.
 *
 * A value the contract does not allow is shown raw instead of throwing: a list
 * must not die because one row is malformed.
 */
export function formatPrice(price: string): string {
	const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
	if (!match) {
		return `$ ${price}`;
	}

	const whole = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	const cents = (match[2] ?? "").padEnd(2, "0");

	return `$ ${whole},${cents}`;
}
