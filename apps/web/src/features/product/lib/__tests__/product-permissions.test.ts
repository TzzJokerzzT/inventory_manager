import type { MeResponse } from "@/lib/api/schemas";
import {
	canManageProducts,
	canPurgeProducts,
	roleForCompany,
} from "../product-permissions";

describe("canManageProducts", () => {
	it("lets an OWNER write", () => {
		expect(canManageProducts("OWNER")).toBe(true);
	});

	it("lets an ADMIN write", () => {
		expect(canManageProducts("ADMIN")).toBe(true);
	});

	it("keeps a MEMBER read-only", () => {
		expect(canManageProducts("MEMBER")).toBe(false);
	});

	it("offers nothing while the role is unknown", () => {
		expect(canManageProducts(undefined)).toBe(false);
	});
});

describe("canPurgeProducts", () => {
	it("lets an OWNER purge", () => {
		expect(canPurgeProducts("OWNER")).toBe(true);
	});

	it("keeps an ADMIN from purging, because the purge is irreversible", () => {
		expect(canPurgeProducts("ADMIN")).toBe(false);
	});

	it("keeps a MEMBER from purging", () => {
		expect(canPurgeProducts("MEMBER")).toBe(false);
	});

	it("offers nothing while the role is unknown", () => {
		expect(canPurgeProducts(undefined)).toBe(false);
	});
});

function me(
	roles: { companyId: string; role: "OWNER" | "ADMIN" | "MEMBER" }[],
) {
	return {
		id: "user-1",
		email: "ana@empresa.com",
		fullName: "Ana Pérez",
		createdAt: "2026-10-06T00:00:00.000Z",
		memberships: roles.map(({ companyId, role }) => ({
			companyId,
			role,
			company: {
				id: companyId,
				name: `Empresa ${companyId}`,
				createdAt: "2026-10-06T00:00:00.000Z",
			},
		})),
	} satisfies MeResponse;
}

describe("roleForCompany", () => {
	it("reads the caller's role in the active company", () => {
		expect(roleForCompany(me([{ companyId: "c1", role: "ADMIN" }]), "c1")).toBe(
			"ADMIN",
		);
	});

	it("ignores the role held in another company", () => {
		expect(
			roleForCompany(
				me([
					{ companyId: "c1", role: "ADMIN" },
					{ companyId: "c2", role: "MEMBER" },
				]),
				"c2",
			),
		).toBe("MEMBER");
	});

	it("returns nothing when the caller has no membership in the company", () => {
		expect(
			roleForCompany(me([{ companyId: "c2", role: "OWNER" }]), "c1"),
		).toBeUndefined();
	});

	it("returns nothing without an identity or an active company", () => {
		expect(roleForCompany(undefined, "c1")).toBeUndefined();
		expect(
			roleForCompany(me([{ companyId: "c1", role: "OWNER" }]), undefined),
		).toBeUndefined();
	});
});
