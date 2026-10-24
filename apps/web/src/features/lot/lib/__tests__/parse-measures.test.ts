import { parseMeasures } from "../parse-measures";

function measuresOf(input: string): number[] {
	const parsed = parseMeasures(input);
	if (!parsed.ok) {
		throw new Error(`Se esperaba una lista válida: ${parsed.message}`);
	}
	return parsed.measures;
}

function errorOf(input: string): string {
	const parsed = parseMeasures(input);
	if (parsed.ok) {
		throw new Error("Se esperaba un error de validación.");
	}
	return parsed.message;
}

describe("parseMeasures", () => {
	it("reads one measure per line", () => {
		expect(measuresOf("12.5\n13\n12.75")).toEqual([12.5, 13, 12.75]);
	});

	it("reads a decimal comma as one value, not as two units", () => {
		// The interface is Spanish: "12,5" is twelve and a half. Reading it as two
		// units would invent stock and cost from an ordinary input.
		expect(parseMeasures("12,5")).toEqual({ ok: true, measures: [12.5] });
		expect(parseMeasures("8,7 8,2")).toEqual({
			ok: true,
			measures: [8.7, 8.2],
		});
	});

	it("accepts a semicolon-separated list, like a pasted export", () => {
		expect(parseMeasures("8,7;8,2;8,9")).toEqual({
			ok: true,
			measures: [8.7, 8.2, 8.9],
		});
	});

	it("reports a token with several commas instead of splitting it", () => {
		const result = parseMeasures("8,7,8,2");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain("8,7,8,2");
		}
	});

	it("mixes lines and spaces, like a pasted column", () => {
		expect(parseMeasures("  8.7\n8.2\n\n  8.9  ")).toEqual({
			ok: true,
			measures: [8.7, 8.2, 8.9],
		});
	});

	it("ignores the blanks left by a pasted list", () => {
		expect(measuresOf("\n\n 12.5 \n\n , 13 ,\n")).toEqual([12.5, 13]);
	});

	it("reports the token it could not read", () => {
		expect(errorOf("12.5\npeso\n13")).toContain("peso");
	});

	it("rejects a zero, a negative and a measure with too many decimals", () => {
		expect(errorOf("0")).toContain("0");
		expect(errorOf("-3")).toContain("-3");
		expect(errorOf("12.3456")).toContain("12.3456");
	});

	it("asks for at least one measure", () => {
		expect(errorOf("")).toMatch(/Ingresá la medida/);
		expect(errorOf("  \n ,, ")).toMatch(/Ingresá la medida/);
	});

	it("accepts 500 units and rejects more", () => {
		const fiveHundred = Array.from({ length: 500 }, () => "12.5").join("\n");
		expect(measuresOf(fiveHundred)).toHaveLength(500);

		const fiveHundredAndOne = Array.from({ length: 501 }, () => "12.5").join(
			"\n",
		);
		expect(errorOf(fiveHundredAndOne)).toMatch(/500 unidades/);
	});
});
