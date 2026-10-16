import { can } from "../src/domain/policies/authorization.js";

describe("can(role, action)", () => {
	describe("member-management rows", () => {
		it("lets an ADMIN or OWNER assign a member, never a MEMBER", () => {
			expect(can("OWNER", "assign_member")).toBe(true);
			expect(can("ADMIN", "assign_member")).toBe(true);
			expect(can("MEMBER", "assign_member")).toBe(false);
		});

		it("lets only an OWNER assign or remove an ADMIN", () => {
			expect(can("OWNER", "assign_admin")).toBe(true);
			expect(can("ADMIN", "assign_admin")).toBe(false);
			expect(can("MEMBER", "assign_admin")).toBe(false);
		});

		it("lets only an OWNER assign or remove an OWNER", () => {
			expect(can("OWNER", "assign_owner")).toBe(true);
			expect(can("ADMIN", "assign_owner")).toBe(false);
			expect(can("MEMBER", "assign_owner")).toBe(false);
		});
	});

	describe("the two rules that are easy to forget", () => {
		it("nobody changes their own role, not even the OWNER", () => {
			expect(can("OWNER", "change_own_role")).toBe(false);
			expect(can("ADMIN", "change_own_role")).toBe(false);
			expect(can("MEMBER", "change_own_role")).toBe(false);
		});

		it("leaving is allowed for everyone except the last active OWNER", () => {
			expect(can("MEMBER", "leave")).toBe(true);
			expect(can("ADMIN", "leave")).toBe(true);
			expect(can("OWNER", "leave", false)).toBe(true);
			expect(can("OWNER", "leave", true)).toBe(false);
		});

		it("denies an OWNER leaving when the last-owner fact is omitted (fail-closed)", () => {
			// The last-OWNER fact must never default to "not last": a company
			// with no active OWNER is an unrecoverable state (§5.8, invariant 4),
			// so forgetting the argument may only deny, never grant.
			expect(can("OWNER", "leave")).toBe(false);
		});
	});

	describe("bootstrap and visibility rows", () => {
		it("lets any authenticated user create a company", () => {
			expect(can("OWNER", "create_company")).toBe(true);
			expect(can("ADMIN", "create_company")).toBe(true);
			expect(can("MEMBER", "create_company")).toBe(true);
		});

		it("lets any member view the users of their own companies", () => {
			expect(can("OWNER", "view_users")).toBe(true);
			expect(can("ADMIN", "view_users")).toBe(true);
			expect(can("MEMBER", "view_users")).toBe(true);
		});
	});
});
