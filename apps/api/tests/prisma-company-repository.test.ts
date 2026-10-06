import { Company } from "../src/domain/entities/company.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaCompanyRepository } from "../src/infrastructure/database/prisma-company-repository.js";

/**
 * The adapter only talks to the `company` delegate, so the fake narrows the
 * injected surface to the two methods the repository actually calls. It is a
 * hand-written double: no database and no generated client is loaded here.
 */
type CompanyDelegate = Pick<PrismaClient, "company">;

function buildFakeDelegate() {
	const create = jest.fn();
	const findMany = jest.fn();

	const delegate = {
		company: { create, findMany },
	} as unknown as CompanyDelegate;

	return { delegate, create, findMany };
}

describe("PrismaCompanyRepository", () => {
	it("create forwards the domain values and returns the Company entity", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockResolvedValue({ id: "company-1", name: "Acme" });

		const repository = new PrismaCompanyRepository({ prisma: delegate });
		const company = Company.create({ id: "company-1", name: "Acme" });

		const result = await repository.create(company);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: {
				id: company.id,
				name: company.name,
				createdAt: company.createdAt,
			},
		});
		expect(result).toBeInstanceOf(Company);
		expect(result.id).toBe(company.id);
		expect(result.name).toBe(company.name);
	});

	it("findAll maps several rows into domain entities in a deterministic order", async () => {
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

		const result = await repository.findAll();

		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith({
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

		const result = await repository.findAll();

		expect(result[0]).toBeInstanceOf(Company);
		expect(result[0].id).toBe("c1");
		expect(result[0].name).toBe("Acme");
		expect(result[0].createdAt).toBeInstanceOf(Date);
		// The raw row carried extra columns; the domain entity exposes none of them.
		expect(JSON.parse(JSON.stringify(result[0]))).not.toHaveProperty("taxId");
	});
});
