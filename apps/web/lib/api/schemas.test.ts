import { ApiError } from "./client";
import {
	parseCompaniesResponse,
	parseCompany,
	parseLoginResponse,
	parseMeResponse,
} from "./schemas";

describe("parseLoginResponse", () => {
	it("returns the access token and its lifetime", () => {
		const parsed = parseLoginResponse({
			accessToken: "token-value",
			expiresIn: 3600,
		});

		expect(parsed).toEqual({ accessToken: "token-value", expiresIn: 3600 });
	});

	it("rejects a response missing the token", () => {
		expect(() => parseLoginResponse({ expiresIn: 3600 })).toThrow(ApiError);
	});

	it("rejects a response whose fields have the wrong type", () => {
		expect(() =>
			parseLoginResponse({ accessToken: "token-value", expiresIn: "3600" }),
		).toThrow(/respuesta inesperada/);
	});

	it("does not leak the provider payload when the shape is wrong", () => {
		let message = "";
		try {
			parseLoginResponse({ id_token: "secret-id-token", refresh_token: "x" });
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).not.toContain("secret-id-token");
	});
});

describe("parseCompaniesResponse", () => {
	it("returns the companies exactly as the API serializes them", () => {
		const parsed = parseCompaniesResponse([
			{ id: "c1", name: "Primera", createdAt: "2026-10-06T00:00:00.000Z" },
			{ id: "c2", name: "Segunda", createdAt: "2026-10-06T01:00:00.000Z" },
		]);

		expect(parsed).toEqual([
			{ id: "c1", name: "Primera", createdAt: "2026-10-06T00:00:00.000Z" },
			{ id: "c2", name: "Segunda", createdAt: "2026-10-06T01:00:00.000Z" },
		]);
	});

	it("accepts an empty list", () => {
		expect(parseCompaniesResponse([])).toEqual([]);
	});

	it("rejects a non-array response", () => {
		expect(() => parseCompaniesResponse({ companies: [] })).toThrow(ApiError);
	});

	it("rejects an entry whose fields are missing or mistyped", () => {
		expect(() =>
			parseCompaniesResponse([{ id: "c1", name: "Primera" }]),
		).toThrow(/respuesta inesperada/);

		expect(() =>
			parseCompaniesResponse([{ id: "c1", name: "Primera", createdAt: 123 }]),
		).toThrow(/respuesta inesperada/);
	});
});

describe("parseCompany", () => {
	it("returns the created company", () => {
		const parsed = parseCompany({
			id: "company-1",
			name: "Acme",
			createdAt: "2026-10-06T00:00:00.000Z",
		});

		expect(parsed.name).toBe("Acme");
	});

	it("rejects a company whose shape changed", () => {
		expect(() => parseCompany({ id: "company-1" })).toThrow(ApiError);
	});
});

function meResponse(overrides: Record<string, unknown> = {}) {
	return {
		id: "user-1",
		email: "ana@empresa.com",
		fullName: "Ana Pérez",
		createdAt: "2026-10-06T00:00:00.000Z",
		memberships: [
			{
				companyId: "c1",
				role: "OWNER",
				company: {
					id: "c1",
					name: "Primera",
					createdAt: "2026-10-06T00:00:00.000Z",
				},
			},
		],
		...overrides,
	};
}

describe("parseMeResponse", () => {
	it("returns the identity and each membership with its company", () => {
		const parsed = parseMeResponse(meResponse());

		expect(parsed).toEqual(meResponse());
		expect(parsed.memberships[0].role).toBe("OWNER");
		expect(parsed.memberships[0].company.name).toBe("Primera");
	});

	it("accepts a user with no full name", () => {
		const parsed = parseMeResponse(meResponse({ fullName: null }));

		expect(parsed.fullName).toBeNull();
	});

	it("accepts a user with no memberships", () => {
		expect(
			parseMeResponse(meResponse({ memberships: [] })).memberships,
		).toEqual([]);
	});

	it("rejects a response missing the identity", () => {
		const { id: _id, ...withoutId } = meResponse();

		expect(() => parseMeResponse(withoutId)).toThrow(ApiError);
	});

	it("rejects a membership with a role outside the contract", () => {
		const response = meResponse({
			memberships: [
				{
					companyId: "c1",
					role: "SUPERUSER",
					company: {
						id: "c1",
						name: "Primera",
						createdAt: "2026-10-06T00:00:00.000Z",
					},
				},
			],
		});

		expect(() => parseMeResponse(response)).toThrow(/respuesta inesperada/);
	});

	it("rejects a membership whose company has the wrong shape", () => {
		const response = meResponse({
			memberships: [{ companyId: "c1", role: "MEMBER", company: { id: "c1" } }],
		});

		expect(() => parseMeResponse(response)).toThrow(/respuesta inesperada/);
	});
});
