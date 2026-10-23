import { formatMovementDate } from "../format-movement-date";

describe("formatMovementDate", () => {
	it("formats the ISO timestamp deterministically", () => {
		// Sin locale ni zona horaria del runtime: el mismo string en Node y en el
		// navegador tiene que rendir lo mismo.
		expect(formatMovementDate("2026-10-21T12:00:00.000Z")).toBe(
			"21-10-2026 12:00",
		);
	});

	it("keeps single digits padded", () => {
		expect(formatMovementDate("2026-01-05T09:07:00.000Z")).toBe(
			"05-01-2026 09:07",
		);
	});

	it("shows the raw value instead of throwing when the timestamp is malformed", () => {
		// Una fila malformada no puede tirar la tabla entera.
		expect(formatMovementDate("ayer")).toBe("ayer");
	});
});
