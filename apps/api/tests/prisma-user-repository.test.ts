import { User } from "../src/domain/entities/user.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaUserRepository } from "../src/infrastructure/database/prisma-user-repository.js";

/**
 * The adapter only talks to the `user` delegate, so the fake narrows the
 * injected surface to the two methods the repository actually calls. It is a
 * hand-written double: no database and no generated client is loaded here.
 */
type UserDelegate = Pick<PrismaClient, "user">;

function buildFakeDelegate() {
	const upsert = jest.fn();
	const findUnique = jest.fn();

	const delegate = {
		user: { upsert, findUnique },
	} as unknown as UserDelegate;

	return { delegate, upsert, findUnique };
}

const ROW = {
	id: "user-1",
	auth0Sub: "auth0|abc123",
	email: "someone@example.com",
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("PrismaUserRepository", () => {
	it("upserts by auth0_sub and lowercases the persisted email", async () => {
		const { delegate, upsert } = buildFakeDelegate();
		upsert.mockResolvedValue(ROW);

		const repository = new PrismaUserRepository({ prisma: delegate });

		const result = await repository.upsertFromIdentity({
			auth0Sub: "auth0|abc123",
			email: "SOMEONE@Example.com",
		});

		expect(upsert).toHaveBeenCalledTimes(1);
		const args = upsert.mock.calls[0][0] as {
			where: unknown;
			create: Record<string, unknown>;
			update: unknown;
		};

		expect(args.where).toEqual({ auth0Sub: "auth0|abc123" });
		expect(args.create).toMatchObject({
			auth0Sub: "auth0|abc123",
			email: "someone@example.com",
		});
		expect(args.create.id).toEqual(expect.any(String));
		expect(args.create.createdAt).toBeInstanceOf(Date);
		// The update branch also carries the lowercased email, so a second
		// login never reintroduces a mixed-case value.
		expect(args.update).toEqual({ email: "someone@example.com" });

		expect(result).toBeInstanceOf(User);
		expect(result.email).toBe("someone@example.com");
	});

	it("returns a User entity, never a raw Prisma row", async () => {
		const { delegate, upsert } = buildFakeDelegate();
		upsert.mockResolvedValue({
			...ROW,
			fullName: "Jane",
			updatedAt: new Date("2026-01-02T00:00:00.000Z"),
		});

		const repository = new PrismaUserRepository({ prisma: delegate });

		const result = await repository.upsertFromIdentity({
			auth0Sub: "auth0|abc123",
			email: "someone@example.com",
		});

		expect(result).toBeInstanceOf(User);
		expect(result).toMatchObject({
			id: "user-1",
			auth0Sub: "auth0|abc123",
			email: "someone@example.com",
		});
		expect(result.createdAt).toBeInstanceOf(Date);
		// The raw row carried extra columns; the domain entity exposes none of them.
		expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty("fullName");
		expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty("updatedAt");
	});

	it("findByAuth0Sub returns a User entity for a hit and null for a miss", async () => {
		const { delegate, findUnique } = buildFakeDelegate();
		findUnique.mockResolvedValue(ROW);

		const repository = new PrismaUserRepository({ prisma: delegate });

		const hit = await repository.findByAuth0Sub("auth0|abc123");

		expect(findUnique).toHaveBeenCalledTimes(1);
		expect(findUnique).toHaveBeenCalledWith({
			where: { auth0Sub: "auth0|abc123" },
		});
		expect(hit).toBeInstanceOf(User);
		expect(hit).toMatchObject({
			id: "user-1",
			auth0Sub: "auth0|abc123",
			email: "someone@example.com",
		});

		findUnique.mockResolvedValue(null);
		await expect(repository.findByAuth0Sub("missing-sub")).resolves.toBeNull();
	});
});
