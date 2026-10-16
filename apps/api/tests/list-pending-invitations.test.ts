import { ListPendingInvitationsUseCase } from "../src/application/use-cases/list-pending-invitations.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";

const USER_ID = "user-1";
const USER_EMAIL = "invitee@example.com";
const INVITER_ID = "owner-1";
const INVITER_EMAIL = "owner@example.com";
const INVITED_AT = new Date("2026-01-02T03:04:05.000Z");

function buildUser(email = USER_EMAIL): User {
	return User.create({
		id: USER_ID,
		auth0Sub: "auth0|user-1",
		email,
	});
}

function inviterUser(fullName: string | null = null): User {
	return User.create({
		id: INVITER_ID,
		auth0Sub: "auth0|owner-1",
		email: INVITER_EMAIL,
		fullName,
	});
}

const RESOLVED_INVITER = {
	id: INVITER_ID,
	fullName: null,
	email: INVITER_EMAIL,
};

async function createCompany(
	repository: InMemoryCompanyRepository,
	id: string,
	name: string,
): Promise<Company> {
	return repository.createOwnedBy(Company.create({ id, name }), {
		userId: INVITER_ID,
		email: INVITER_EMAIL,
	});
}

function invitation(
	companyId: string,
	overrides: {
		id?: string;
		email?: string;
		role?: MembershipRole;
		status?: "INVITED" | "ACTIVE" | "REVOKED";
		createdAt?: Date;
	} = {},
): Membership {
	return Membership.create({
		id: overrides.id ?? `membership-${companyId}`,
		userId: null,
		invitedEmail: overrides.email ?? USER_EMAIL,
		companyId,
		role: overrides.role ?? "MEMBER",
		status: overrides.status ?? "INVITED",
		invitedBy: INVITER_ID,
		acceptedAt: null,
		createdAt: overrides.createdAt ?? INVITED_AT,
	});
}

function buildUseCase(users: User[] = [inviterUser()]) {
	const companyRepository = new InMemoryCompanyRepository();
	const membershipRepository = new InMemoryMembershipRepository();
	const userRepository = createFakeUserRepository(users);
	const useCase = new ListPendingInvitationsUseCase({
		companyRepository,
		membershipRepository,
		userRepository,
	});

	return { useCase, companyRepository, membershipRepository, userRepository };
}

describe("ListPendingInvitationsUseCase", () => {
	it("returns an empty list when nothing is pending", async () => {
		const { useCase } = buildUseCase();

		await expect(useCase.execute(buildUser())).resolves.toEqual([]);
	});

	it("returns a pending invitation with its membership facts and company", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		const acme = await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(invitation("company-a", { role: "ADMIN" }));

		const result = await useCase.execute(buildUser());

		expect(result).toEqual([
			{
				membershipId: "membership-company-a",
				companyId: "company-a",
				role: "ADMIN",
				invitedAt: INVITED_AT.toISOString(),
				company: acme,
				inviter: RESOLVED_INVITER,
			},
		]);
	});

	it("returns every pending invitation with its own company", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		await createCompany(companyRepository, "company-b", "Globex");
		membershipRepository.save(invitation("company-a", { role: "MEMBER" }));
		membershipRepository.save(invitation("company-b", { role: "OWNER" }));

		const result = await useCase.execute(buildUser());

		const byCompany = new Map(result.map((item) => [item.companyId, item]));
		expect(byCompany.size).toBe(2);
		expect(byCompany.get("company-a")).toMatchObject({
			role: "MEMBER",
			company: { id: "company-a", name: "Acme" },
		});
		expect(byCompany.get("company-b")).toMatchObject({
			role: "OWNER",
			company: { id: "company-b", name: "Globex" },
		});
	});

	it("resolves the companies in a single batch read, never one per invitation", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		await createCompany(companyRepository, "company-b", "Globex");
		membershipRepository.save(invitation("company-a"));
		membershipRepository.save(invitation("company-b"));
		const findByIds = jest.spyOn(companyRepository, "findByIds");

		await useCase.execute(buildUser());

		expect(findByIds).toHaveBeenCalledTimes(1);
		expect(findByIds).toHaveBeenCalledWith(["company-a", "company-b"]);
	});

	it("resolves the inviter summary so the caller knows who invited them", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase([
			inviterUser("Owner Name"),
		]);
		await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(invitation("company-a"));

		const result = await useCase.execute(buildUser());

		expect(result[0]?.inviter).toEqual({
			id: INVITER_ID,
			fullName: "Owner Name",
			email: INVITER_EMAIL,
		});
	});

	it("answers a null inviter without hiding the invitation when the user row is gone", async () => {
		// The invitation is the important fact; the inviter is context. An
		// unresolvable inviter must not drop the row and must not throw.
		const { useCase, companyRepository, membershipRepository } = buildUseCase(
			[],
		);
		await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(invitation("company-a"));

		const result = await useCase.execute(buildUser());

		expect(result).toHaveLength(1);
		expect(result[0]?.inviter).toBeNull();
	});

	it("resolves repeated inviters in a single batch read, deduplicated", async () => {
		const { useCase, companyRepository, membershipRepository, userRepository } =
			buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		await createCompany(companyRepository, "company-b", "Globex");
		// Same person, two invitations: the inviter must be read once, not once
		// per invitation.
		membershipRepository.save(invitation("company-a"));
		membershipRepository.save(invitation("company-b"));
		const findByIds = jest.spyOn(userRepository, "findByIds");

		await useCase.execute(buildUser());

		expect(findByIds).toHaveBeenCalledTimes(1);
		expect(findByIds).toHaveBeenCalledWith([INVITER_ID]);
	});

	it("drops a membership whose company the batch read did not return", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(invitation("company-a"));
		// Fail-closed: the invitation points at a company that no longer exists,
		// so it must not be emitted without the company it is an invitation to.
		membershipRepository.save(invitation("company-ghost"));

		const result = await useCase.execute(buildUser());

		expect(result.map((item) => item.companyId)).toEqual(["company-a"]);
	});

	it("never returns another email's invitation", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		await createCompany(companyRepository, "company-b", "Globex");
		membershipRepository.save(invitation("company-a"));
		membershipRepository.save(
			invitation("company-b", { email: "other@example.com" }),
		);

		const result = await useCase.execute(buildUser());

		expect(result.map((item) => item.companyId)).toEqual(["company-a"]);
	});

	it("never returns an ACTIVE membership addressed to the caller", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		// Already accepted: the same email, a different status, so it is not
		// pending any more and must not appear in the invitation list.
		membershipRepository.save(invitation("company-a", { status: "ACTIVE" }));

		const result = await useCase.execute(buildUser());

		expect(result).toEqual([]);
	});

	it("serializes each company through its own toJSON for the wire", async () => {
		const { useCase, companyRepository, membershipRepository } = buildUseCase();
		await createCompany(companyRepository, "company-a", "Acme");
		membershipRepository.save(invitation("company-a"));

		const result = await useCase.execute(buildUser());

		expect(JSON.parse(JSON.stringify(result[0]?.company))).toEqual({
			id: "company-a",
			name: "Acme",
			createdAt: expect.any(String),
		});
	});
});
