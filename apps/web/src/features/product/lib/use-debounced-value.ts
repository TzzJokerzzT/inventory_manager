"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` only after it has stopped changing for `delayMs`.
 *
 * The product list keeps the input's value in its own state and feeds this hook
 * with it: the field stays responsive while the query key — and therefore the
 * request — moves once per pause, not once per keystroke. The timer restarts on
 * every change, so the last keystroke is the one that wins.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);

	return debounced;
}
