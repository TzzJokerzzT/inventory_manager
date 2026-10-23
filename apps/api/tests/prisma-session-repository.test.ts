import { Session } from "../src/domain/entities/session.js";
import type { PrismaClient } from "../src/infrastructure/database/generated/prisma/client.js";
import { PrismaSessionRepository } from "../src/infrastructure/database/prisma-session-repository.js";

/**
 * The adapter only talks to the `session` delegate, so the fake narrows the
 * injected surface to the methods the repository actually calls. It is a
 * hand-written double: no database and no generated client is loaded here.
 */
type SessionDelegate = Pick<PrismaClient, "session">;

function buildFakeDelegate() {
	const create = jest.fn();
	const findUnique = jest.fn();
	const updateMany = jest.fn();

	const delegate = {
		session: { create, findUnique, updateMany },
	} as unknown as SessionDelegate;

	return { delegate, create, findUnique, updateMany };
}

const NOW = new Date("2026-01-01T00:00:00.000Z");

const ROW = {
	id: "session-1",
	userId: "user-1",
	createdAt: NOW,
	lastActivityAt: NOW,
	revokedAt: null,
};

describe("PrismaSessionRepository", () => {
	it("writes the id and the dates the entity generated, never a database default", async () => {
		const { delegate, create } = buildFakeDelegate();
		create.mockResolvedValue(ROW);
		const repository = new PrismaSessionRepository({ prisma: delegate });
		const session = Session.create({ userId: "user-1", createdAt: NOW });

		const result = await repository.create(session);

		const args = create.mock.calls[0][0] as { data: Record<string, unknown> };
		expect(args.data).toMatchObject({
			id: session.id,
			userId: "user-1",
			createdAt: NOW,
			lastActivityAt: NOW,
			revokedAt: null,
		});
		expect(result.id).toBe("session-1");
		expect(result.lastActivityAt).toEqual(NOW);
	});

	it("maps a missing row to null instead of throwing", async () => {
		const { delegate, findUnique } = buildFakeDelegate();
		findUnique.mockResolvedValue(null);
		const repository = new PrismaSessionRepository({ prisma: delegate });

		await expect(repository.findById("missing")).resolves.toBeNull();
	});

	it("touches with updateMany so a row removed in between is a no-op, not a P2025", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 0 });
		const repository = new PrismaSessionRepository({ prisma: delegate });
		const later = new Date("2026-01-02T00:00:00.000Z");

		await repository.touch("session-1", later);

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "session-1" },
			data: { lastActivityAt: later },
		});
	});

	it("only revokes a row that is not revoked yet, so a second logout keeps the first timestamp", async () => {
		const { delegate, updateMany } = buildFakeDelegate();
		updateMany.mockResolvedValue({ count: 1 });
		const repository = new PrismaSessionRepository({ prisma: delegate });
		const signedOutAt = new Date("2026-01-03T00:00:00.000Z");

		await repository.revoke("session-1", signedOutAt);

		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "session-1", revokedAt: null },
			data: { revokedAt: signedOutAt },
		});
	});
});
