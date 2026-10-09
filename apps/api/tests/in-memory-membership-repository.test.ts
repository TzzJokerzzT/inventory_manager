import { Membership } from "../src/domain/entities/membership.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";

function activeMembership(companyId: string, userId = "user-1"): Membership {
	return Membership.create({
		userId,
		invitedEmail: "member@example.com",
		companyId,
		role: "MEMBER",
		status: "ACTIVE",
		invitedBy: "owner-1",
		acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
	});
}

describe("InMemoryMembershipRepository", () => {
	it("returns the user's ACTIVE membership for the company", async () => {
		const repository = new InMemoryMembershipRepository();
		const membership = activeMembership("company-1");
		repository.save(membership);

		const result = await repository.findActiveByUserAndCompany(
			"user-1",
			"company-1",
		);

		expect(result).toBe(membership);
	});

	it("a REVOKED membership does not grant access", async () => {
		const repository = new InMemoryMembershipRepository();
		repository.save(
			Membership.create({
				userId: "user-1",
				invitedEmail: "member@example.com",
				companyId: "company-1",
				role: "MEMBER",
				status: "REVOKED",
				invitedBy: "owner-1",
				acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
		);

		await expect(
			repository.findActiveByUserAndCompany("user-1", "company-1"),
		).resolves.toBeNull();
	});

	it("an INVITED membership does not grant access", async () => {
		const repository = new InMemoryMembershipRepository();
		repository.save(
			Membership.create({
				userId: "user-1",
				invitedEmail: "pending@example.com",
				companyId: "company-1",
				role: "MEMBER",
				status: "INVITED",
				invitedBy: "owner-1",
				acceptedAt: null,
			}),
		);

		await expect(
			repository.findActiveByUserAndCompany("user-1", "company-1"),
		).resolves.toBeNull();
	});

	it("a user who belongs to two companies resolves the right one and not the other", async () => {
		const repository = new InMemoryMembershipRepository();
		repository.save(activeMembership("company-a"));
		repository.save(activeMembership("company-b"));

		const first = await repository.findActiveByUserAndCompany(
			"user-1",
			"company-a",
		);
		const second = await repository.findActiveByUserAndCompany(
			"user-1",
			"company-b",
		);

		expect(first?.companyId).toBe("company-a");
		expect(second?.companyId).toBe("company-b");
	});

	it("a user with no membership resolves nothing", async () => {
		const repository = new InMemoryMembershipRepository();
		repository.save(activeMembership("company-a", "user-1"));

		await expect(
			repository.findActiveByUserAndCompany("user-2", "company-a"),
		).resolves.toBeNull();
	});
});
