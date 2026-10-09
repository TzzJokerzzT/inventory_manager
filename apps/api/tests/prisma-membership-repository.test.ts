import { Membership } from "../src/domain/entities/membership.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaMembershipRepository } from "../src/infrastructure/database/prisma-membership-repository.js";

/**
 * The adapter only talks to the `membership` delegate, so the fake narrows the
 * injected surface to the one method the repository actually calls. It is a
 * hand-written double: no database and no generated client is loaded here.
 */
type MembershipDelegate = Pick<PrismaClient, "membership">;

function buildFakeDelegate() {
	const findFirst = jest.fn();
	const findMany = jest.fn();

	const delegate = {
		membership: { findFirst, findMany },
	} as unknown as MembershipDelegate;

	return { delegate, findFirst, findMany };
}

const ROW = {
	id: "membership-1",
	userId: "user-1",
	invitedEmail: "member@example.com",
	companyId: "company-1",
	role: "MEMBER",
	status: "ACTIVE",
	invitedBy: "owner-1",
	acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("PrismaMembershipRepository", () => {
	it("filters by userId, companyId and status: ACTIVE, then maps the row into an entity", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(ROW);

		const repository = new PrismaMembershipRepository({ prisma: delegate });
		const result = await repository.findActiveByUserAndCompany(
			"user-1",
			"company-1",
		);

		// The `status: "ACTIVE"` filter is the security rule: Postgres can
		// never hand back a REVOKED or still-INVITED membership for an active
		// lookup.
		expect(findFirst).toHaveBeenCalledTimes(1);
		expect(findFirst).toHaveBeenCalledWith({
			where: { userId: "user-1", companyId: "company-1", status: "ACTIVE" },
		});

		expect(result).toBeInstanceOf(Membership);
		expect(result).toMatchObject({
			id: "membership-1",
			userId: "user-1",
			companyId: "company-1",
			role: "MEMBER",
			status: "ACTIVE",
		});
	});

	it("returns null when no ACTIVE row exists", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue(null);

		const repository = new PrismaMembershipRepository({ prisma: delegate });

		await expect(
			repository.findActiveByUserAndCompany("user-1", "company-1"),
		).resolves.toBeNull();
	});

	it("returns a domain entity, never a raw Prisma row", async () => {
		const { delegate, findFirst } = buildFakeDelegate();
		findFirst.mockResolvedValue({
			...ROW,
			invitedEmail: "MEMBER@EXAMPLE.COM",
			extraColumn: "leak-me-not",
		});

		const repository = new PrismaMembershipRepository({ prisma: delegate });
		const result = await repository.findActiveByUserAndCompany(
			"user-1",
			"company-1",
		);

		expect(result).toBeInstanceOf(Membership);
		// The entity normalises the email and drops columns it does not model.
		expect(result?.invitedEmail).toBe("member@example.com");
		expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty(
			"extraColumn",
		);
	});

	it("lists ACTIVE memberships filtered by userId and maps every row into an entity", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			ROW,
			{ ...ROW, id: "membership-2", companyId: "company-2", role: "OWNER" },
		]);

		const repository = new PrismaMembershipRepository({ prisma: delegate });
		const result = await repository.findActiveByUser("user-1");

		// The `status: "ACTIVE"` filter is the security rule: Postgres can
		// never hand back a REVOKED or still-INVITED membership in this list.
		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith({
			where: { userId: "user-1", status: "ACTIVE" },
		});

		expect(result).toHaveLength(2);
		expect(result[0]).toBeInstanceOf(Membership);
		expect(result.map((membership) => membership.companyId)).toEqual([
			"company-1",
			"company-2",
		]);
		expect(result.map((membership) => membership.status)).toEqual([
			"ACTIVE",
			"ACTIVE",
		]);
	});

	it("scopes the query to the caller so another user's ACTIVE rows can never leak", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([]);

		const repository = new PrismaMembershipRepository({ prisma: delegate });
		await repository.findActiveByUser("user-1");

		// The userId filter travels in the WHERE clause, so the database -- not
		// the mapping code -- is what keeps user-2's rows out of user-1's list.
		expect(findMany).toHaveBeenCalledWith({
			where: { userId: "user-1", status: "ACTIVE" },
		});
	});

	it("returns an empty list when the user has no ACTIVE membership", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([]);

		const repository = new PrismaMembershipRepository({ prisma: delegate });

		await expect(repository.findActiveByUser("user-2")).resolves.toEqual([]);
	});

	it("maps list rows into domain entities, never raw Prisma rows", async () => {
		const { delegate, findMany } = buildFakeDelegate();
		findMany.mockResolvedValue([
			{
				...ROW,
				invitedEmail: "MEMBER@EXAMPLE.COM",
				extraColumn: "leak-me-not",
			},
		]);

		const repository = new PrismaMembershipRepository({ prisma: delegate });
		const result = await repository.findActiveByUser("user-1");

		expect(result[0]).toBeInstanceOf(Membership);
		expect(result[0]?.invitedEmail).toBe("member@example.com");
		expect(JSON.parse(JSON.stringify(result[0]))).not.toHaveProperty(
			"extraColumn",
		);
	});
});
