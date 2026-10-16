import {
	Membership,
	type MembershipRole,
	type MembershipStatus,
} from "../src/domain/entities/membership.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

const BASE = {
	userId: "user-1",
	invitedEmail: "member@example.com",
	companyId: "company-1",
	role: "MEMBER",
	status: "ACTIVE",
	invitedBy: "owner-1",
} as const;

describe("Membership", () => {
	it("lowercases the invited email so a mixed-case input is not representable", () => {
		const membership = Membership.create({
			...BASE,
			invitedEmail: "Member@Example.com",
		});

		expect(membership.invitedEmail).toBe("member@example.com");
	});

	it("allows a null userId: the invitation exists before the account does", () => {
		const membership = Membership.create({
			...BASE,
			userId: null,
			status: "INVITED",
			acceptedAt: null,
		});

		expect(membership.userId).toBeNull();
		expect(membership.status).toBe("INVITED");
		expect(membership.acceptedAt).toBeNull();
	});

	it("rejects an empty invited email", () => {
		expect(() => Membership.create({ ...BASE, invitedEmail: "   " })).toThrow(
			DomainError,
		);
	});

	it("rejects an empty company id", () => {
		expect(() => Membership.create({ ...BASE, companyId: "   " })).toThrow(
			DomainError,
		);
	});

	it("rejects an empty inviter id", () => {
		expect(() => Membership.create({ ...BASE, invitedBy: "   " })).toThrow(
			DomainError,
		);
	});

	it("rejects an unknown role", () => {
		expect(() =>
			Membership.create({
				...BASE,
				role: "SUPERUSER" as unknown as MembershipRole,
			}),
		).toThrow(DomainError);
	});

	it("rejects an unknown status", () => {
		expect(() =>
			Membership.create({
				...BASE,
				status: "SUSPENDED" as unknown as MembershipStatus,
			}),
		).toThrow(DomainError);
	});

	it("generates an id and timestamps when they are not provided", () => {
		const membership = Membership.create(BASE);

		expect(membership.id).toEqual(expect.any(String));
		expect(membership.createdAt).toBeInstanceOf(Date);
		expect(membership.updatedAt).toBeInstanceOf(Date);
	});

	it("preserves an explicitly provided id, timestamps and acceptedAt", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const updatedAt = new Date("2026-01-02T00:00:00.000Z");
		const acceptedAt = new Date("2026-01-01T12:00:00.000Z");

		const membership = Membership.create({
			...BASE,
			id: "membership-1",
			acceptedAt,
			createdAt,
			updatedAt,
		});

		expect(membership.id).toBe("membership-1");
		expect(membership.acceptedAt).toBe(acceptedAt);
		expect(membership.createdAt).toBe(createdAt);
		expect(membership.updatedAt).toBe(updatedAt);
	});
});
