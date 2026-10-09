import { GetCurrentUserUseCase } from "../src/application/use-cases/get-current-user.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";

const USER_ID = "user-1";
const USER_EMAIL = "user@example.com";
const USER_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function buildUser(fullName?: string | null): User {
	return User.create({
		id: USER_ID,
		auth0Sub: "auth0|user-1",
		email: USER_EMAIL,
		createdAt: USER_CREATED_AT,
		fullName,
	});
}

function activeMembership(companyId: string, role: MembershipRole): Membership {
	return Membership.create({
		userId: USER_ID,
		invitedEmail: USER_EMAIL,
		companyId,
		role,
		status: "ACTIVE",
		invitedBy: "owner-1",
		acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
	});
}

async function createCompany(
	repository: InMemoryCompanyRepository,
	id: string,
	name: string,
): Promise<Company> {
	return repository.createOwnedBy(Company.create({ id, name }), {
		userId: USER_ID,
		email: USER_EMAIL,
	});
}

function buildUseCase() {
	const companyRepository = new InMemoryCompanyRepository();
	const membershipRepository = new InMemoryMembershipRepository();
	const useCase = new GetCurrentUserUseCase({
		companyRepository,
		membershipRepository,
	});

	return { useCase, companyRepository, membershipRepository };
}

describe("GetCurrentUserUseCase", () => {
	it("returns the caller's public fields and each membership with its company and role", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		const acme = await createCompany(companyRepository, "company-a", "Acme");
		const globex = await createCompany(
			companyRepository,
			"company-b",
			"Globex",
		);
		membershipRepository.save(activeMembership("company-a", "OWNER"));
		membershipRepository.save(activeMembership("company-b", "ADMIN"));

		const result = await useCase.execute(buildUser());

		expect(result.user).toEqual({
			id: USER_ID,
			email: USER_EMAIL,
			fullName: null,
			createdAt: USER_CREATED_AT.toISOString(),
		});

		expect(result.memberships).toHaveLength(2);
		const byCompany = new Map(
			result.memberships.map((membership) => [
				membership.companyId,
				membership,
			]),
		);
		expect(byCompany.get("company-a")?.role).toBe("OWNER");
		expect(byCompany.get("company-b")?.role).toBe("ADMIN");
		// `company` is the domain entity from `findAllForUser`, not a copy.
		expect(byCompany.get("company-a")?.company).toBe(acme);
		expect(byCompany.get("company-b")?.company).toBe(globex);
	});

	it("serializes each company through its own toJSON", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(activeMembership("company-a", "OWNER"));

		const result = await useCase.execute(buildUser());

		expect(JSON.parse(JSON.stringify(result.memberships[0]?.company))).toEqual({
			id: "company-a",
			name: "Acme",
			createdAt: expect.any(String),
		});
	});

	it("returns an empty memberships list for a user with no memberships", async () => {
		const { useCase } = buildUseCase();

		const result = await useCase.execute(buildUser());

		expect(result.memberships).toEqual([]);
	});

	it("never exposes auth0Sub and builds an explicit user view", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(activeMembership("company-a", "OWNER"));

		const result = await useCase.execute(buildUser());

		// The Auth0 subject is the backend's correlation key with the identity
		// provider, not a user-facing field, so it must never reach the payload.
		expect(JSON.stringify(result)).not.toContain("auth0Sub");
		expect(result.user).not.toHaveProperty("auth0Sub");
		expect(Object.keys(result.user).sort()).toEqual([
			"createdAt",
			"email",
			"fullName",
			"id",
		]);
	});

	it("returns the caller's fullName once it is set", async () => {
		const { useCase } = buildUseCase();

		const result = await useCase.execute(buildUser("Alexis Buelvas"));

		// Built field by field: the public view carries the modelled name and
		// still never the Auth0 subject.
		expect(result.user.fullName).toBe("Alexis Buelvas");
		expect(result.user).not.toHaveProperty("auth0Sub");
	});

	it("drops a membership whose company the user's listing did not return", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(activeMembership("company-a", "OWNER"));
		// Fail-closed: the membership points at a company that
		// `findAllForUser` never returned, so it must not be emitted.
		membershipRepository.save(activeMembership("company-ghost", "MEMBER"));

		const result = await useCase.execute(buildUser());

		expect(
			result.memberships.map((membership) => membership.companyId),
		).toEqual(["company-a"]);
	});

	it("ignores another user's ACTIVE membership for one of the caller's companies", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		// Same company, different user: the caller's own list must not pick up
		// someone else's membership, even though the company is one of theirs.
		membershipRepository.save(
			Membership.create({
				userId: "user-2",
				invitedEmail: "other@example.com",
				companyId: "company-a",
				role: "OWNER",
				status: "ACTIVE",
				invitedBy: "owner-2",
				acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
		);

		const result = await useCase.execute(buildUser());

		expect(result.memberships).toEqual([]);
	});
});
