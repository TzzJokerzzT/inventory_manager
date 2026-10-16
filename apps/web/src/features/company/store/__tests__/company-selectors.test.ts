import type { Company } from "@/lib/api/schemas";
import {
	selectActiveCompany,
	shouldShowCompanySwitcher,
} from "../company-selectors";

function company(id: string, name: string): Company {
	return { id, name, createdAt: "2026-10-06T00:00:00.000Z" };
}

describe("selectActiveCompany", () => {
	const companies = [
		company("c1", "Primera"),
		company("c2", "Segunda"),
		company("c3", "Tercera"),
	];

	it("has no active company with zero companies", () => {
		expect(selectActiveCompany([], "c1")).toBeUndefined();
		expect(selectActiveCompany(undefined, "c1")).toBeUndefined();
	});

	it("activates the only company when there is exactly one", () => {
		const single = [company("c1", "Única")];

		expect(selectActiveCompany(single, undefined)).toBe(single[0]);
		expect(selectActiveCompany(single, "c1")).toBe(single[0]);
	});

	it("prefers the stored id when it is still in the list", () => {
		expect(selectActiveCompany(companies, "c2")).toBe(companies[1]);
	});

	it("falls back to the first company when the stored id disappeared", () => {
		expect(selectActiveCompany(companies, "desaparecida")).toBe(companies[0]);
	});
});

describe("shouldShowCompanySwitcher", () => {
	it("hides with zero or one company", () => {
		expect(shouldShowCompanySwitcher(undefined)).toBe(false);
		expect(shouldShowCompanySwitcher([])).toBe(false);
		expect(shouldShowCompanySwitcher([company("c1", "Única")])).toBe(false);
	});

	it("shows with two or more companies", () => {
		expect(
			shouldShowCompanySwitcher([
				company("c1", "Primera"),
				company("c2", "Segunda"),
			]),
		).toBe(true);
	});
});
