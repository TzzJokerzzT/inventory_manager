import { Company } from "../src/domain/entities/company.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";

describe("InMemoryCompanyRepository", () => {
	it("createOwnedBy stores the company and an OWNER/ACTIVE membership for the creator", async () => {
		const repository = new InMemoryCompanyRepository();
		const company = Company.create({ name: "Acme" });

		const result = await repository.createOwnedBy(company, {
			userId: "user-1",
			email: "Owner@Example.com",
		});

		expect(result).toBe(company);

		const memberships = repository.listMemberships();
		expect(memberships).toHaveLength(1);
		expect(memberships[0]).toMatchObject({
			userId: "user-1",
			companyId: company.id,
			role: "OWNER",
			status: "ACTIVE",
			invitedEmail: "owner@example.com",
			invitedBy: "user-1",
		});
		expect(memberships[0].acceptedAt).toBeInstanceOf(Date);
	});

	it("findAllForUser returns only the companies the user belongs to", async () => {
		const repository = new InMemoryCompanyRepository();

		const own = Company.create({ name: "Acme" });
		const other = Company.create({ name: "Globex" });

		await repository.createOwnedBy(own, {
			userId: "user-1",
			email: "owner@example.com",
		});
		await repository.createOwnedBy(other, {
			userId: "user-2",
			email: "other@example.com",
		});

		const companies = await repository.findAllForUser("user-1");

		expect(companies).toHaveLength(1);
		expect(companies[0].id).toBe(own.id);
		expect(companies[0].name).toBe("Acme");
	});
});
