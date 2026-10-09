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
	const update = jest.fn();

	const delegate = {
		user: { upsert, findUnique, update },
	} as unknown as UserDelegate;

	return { delegate, upsert, findUnique, update };
}

const ROW = {
	id: "user-1",
	auth0Sub: "auth0|abc123",
	email: "someone@example.com",
	fullName: null,
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
		// `fullName` is a modelled domain field, so it DOES cross the port
		// boundary: the raw row value has to be mapped onto the entity.
		expect(result.fullName).toBe("Jane");
		expect(JSON.parse(JSON.stringify(result)).fullName).toBe("Jane");
		// `updatedAt` is a raw Prisma column the domain does not model, so it
		// must still never surface through the entity.
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

	it("findByAuth0Sub maps the modelled fullName off the row", async () => {
		const { delegate, findUnique } = buildFakeDelegate();
		findUnique.mockResolvedValue({ ...ROW, fullName: "Jane" });

		const repository = new PrismaUserRepository({ prisma: delegate });

		const hit = await repository.findByAuth0Sub("auth0|abc123");

		expect(hit?.fullName).toBe("Jane");
	});

	describe("updateFullName", () => {
		it("writes by primary key and returns the mapped entity", async () => {
			const { delegate, update } = buildFakeDelegate();
			update.mockResolvedValue({ ...ROW, fullName: "Alexis Buelvas" });

			const repository = new PrismaUserRepository({ prisma: delegate });

			const result = await repository.updateFullName(
				"user-1",
				"Alexis Buelvas",
			);

			expect(update).toHaveBeenCalledTimes(1);
			expect(update).toHaveBeenCalledWith({
				where: { id: "user-1" },
				data: { fullName: "Alexis Buelvas" },
			});
			expect(result).toBeInstanceOf(User);
			expect(result?.fullName).toBe("Alexis Buelvas");
		});

		it("normalises the incoming value through the domain point", async () => {
			const { delegate, update } = buildFakeDelegate();
			update.mockResolvedValue(ROW);

			const repository = new PrismaUserRepository({ prisma: delegate });

			await repository.updateFullName("user-1", "  Alexis Buelvas  ");
			expect(update).toHaveBeenLastCalledWith({
				where: { id: "user-1" },
				data: { fullName: "Alexis Buelvas" },
			});

			await repository.updateFullName("user-1", "   ");
			expect(update).toHaveBeenLastCalledWith({
				where: { id: "user-1" },
				data: { fullName: null },
			});

			await repository.updateFullName("user-1", null);
			expect(update).toHaveBeenLastCalledWith({
				where: { id: "user-1" },
				data: { fullName: null },
			});
		});

		it("returns null instead of letting a raw P2025 escape", async () => {
			const { delegate, update } = buildFakeDelegate();
			update.mockRejectedValue(
				Object.assign(new Error("Record to update not found."), {
					code: "P2025",
				}),
			);

			const repository = new PrismaUserRepository({ prisma: delegate });

			await expect(
				repository.updateFullName("missing-user", "Jane"),
			).resolves.toBeNull();
		});

		it("rethrows any error that is not a missing row", async () => {
			const { delegate, update } = buildFakeDelegate();
			const failure = Object.assign(new Error("connection reset"), {
				code: "P1001",
			});
			update.mockRejectedValue(failure);

			const repository = new PrismaUserRepository({ prisma: delegate });

			await expect(repository.updateFullName("user-1", "Jane")).rejects.toBe(
				failure,
			);
		});
	});
});
