import { Company } from "../src/domain/entities/company.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaCompanyRepository } from "../src/infrastructure/database/prisma-company-repository.js";

/**
 * The adapter talks to the `company` and `membership` delegates plus
 * `$transaction`, so the fake narrows the injected surface to exactly those
 * three. It is a hand-written double: no database and no generated client is
 * loaded here.
 */
type CompanyDelegate = Pick<
	PrismaClient,
	"company" | "membership" | "$transaction"
>;

function buildFakeDelegate() {
	const create = jest.fn();
	const findMany = jest.fn();
	const membershipCreate = jest.fn();
	const transaction = jest.fn(async (operations: unknown[]) =>
		Promise.all(operations),
	);

	const delegate = {
		company: { create, findMany },
		membership: { create: membershipCreate },
		$transaction: transaction,
	} as unknown as CompanyDelegate;

	return { delegate, create, findMany, membershipCreate, transaction };
}

describe("PrismaCompanyRepository", () => {
	it("createOwnedBy writes the company and its OWNER membership in one transaction", async () => {
		const { delegate, create, membershipCreate, transaction } =
			buildFakeDelegate();
		create.mockResolvedValue({ id: "company-1", name: "Acme" });
		membershipCreate.mockResolvedValue({ id: "membership-1" });

		const repository = new PrismaCompanyRepository({ prisma: delegate });
		const company = Company.create({ id: "company-1", name: "Acme" });

		const result = await repository.createOwnedBy(company, {
			userId: "user-1",
			email: "Owner@Example.com",
		});

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: {
				id: company.id,
				name: company.name,
				createdAt: company.createdAt,
			},
		});

		expect(membershipCreate).toHaveBeenCalledTimes(1);
		const membershipArgs = membershipCreate.mock.calls[0][0] as {
			data: Record<string, unknown>;
		};
		expect(membershipArgs.data).toMatchObject({
			userId: "user-1",
			companyId: company.id,
			role: "OWNER",
			status: "ACTIVE",
			invitedEmail: "owner@example.com",
			invitedBy: "user-1",
		});
		expect(membershipArgs.data.acceptedAt).toBeInstanceOf(Date);

		// Both writes share one transaction, so a company can never exist
		// without its owner.
		expect(transaction).toHaveBeenCalledTimes(1);
		const operations = transaction.mock.calls[0][0] as unknown[];
		expect(operations).toHaveLength(2);

		expect(result).toBeInstanceOf(Company);
		expect(result.id).toBe(company.id);
	});

	it("findAllForUser filters through memberships and maps rows into entities", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			{
				id: "c1",
				name: "First",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
			{
				id: "c2",
				name: "Second",
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
			},
		]);

		const repository = new PrismaCompanyRepository({ prisma: delegate });

		const result = await repository.findAllForUser("user-1");

		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith({
			where: {
				memberships: {
					some: { userId: "user-1", status: "ACTIVE" },
				},
			},
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});
		expect(result).toHaveLength(2);
		expect(result[0]).toBeInstanceOf(Company);
		expect(result[1]).toBeInstanceOf(Company);
		expect(result[0]).toMatchObject({ id: "c1", name: "First" });
		expect(result[1]).toMatchObject({ id: "c2", name: "Second" });
	});

	it("returns domain entities, never raw Prisma rows", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			{
				id: "c1",
				name: "Acme",
				taxId: "123",
				address: null,
				phone: null,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			},
		]);

		const repository = new PrismaCompanyRepository({ prisma: delegate });

		const result = await repository.findAllForUser("user-1");

		expect(result[0]).toBeInstanceOf(Company);
		expect(result[0].id).toBe("c1");
		expect(result[0].name).toBe("Acme");
		expect(result[0].createdAt).toBeInstanceOf(Date);
		// The raw row carried extra columns; the domain entity exposes none of them.
		expect(JSON.parse(JSON.stringify(result[0]))).not.toHaveProperty("taxId");
	});
});
