import { Session } from "../../domain/entities/session.js";
import type { SessionRepository } from "../../domain/repositories/session-repository.js";
import type { PrismaClient } from "./generated/prisma/client.js";

/**
 * The adapter depends only on the Prisma `session` delegate, so the injected
 * surface stays as small as the port needs. The import is type-only on
 * purpose: the generated client is ESM-first and Jest runs through
 * `@swc/jest` in CommonJS, so a runtime import would break the test suite.
 */
type SessionDelegate = Pick<PrismaClient, "session">;

export interface PrismaSessionRepositoryDependencies {
	prisma: SessionDelegate;
}

/**
 * Prisma-backed adapter for the {@link SessionRepository} port.
 *
 * Every row is mapped back to the domain entity, so a raw Prisma object never
 * crosses the port boundary and the expiry rule lives in one place. The create
 * path writes the id the entity already generated, so the database default
 * (`gen_random_uuid()`) never silently replaces it.
 */
export class PrismaSessionRepository implements SessionRepository {
	private readonly prisma: SessionDelegate;

	constructor(dependencies: PrismaSessionRepositoryDependencies) {
		this.prisma = dependencies.prisma;
	}

	async create(session: Session): Promise<Session> {
		const row = await this.prisma.session.create({
			data: {
				id: session.id,
				userId: session.userId,
				createdAt: session.createdAt,
				lastActivityAt: session.lastActivityAt,
				refreshTokenHash: session.refreshTokenHash,
				revokedAt: session.revokedAt,
			},
		});

		return PrismaSessionRepository.toEntity(row);
	}

	async findById(sessionId: string): Promise<Session | null> {
		const row = await this.prisma.session.findUnique({
			where: { id: sessionId },
		});

		return row === null ? null : PrismaSessionRepository.toEntity(row);
	}

	async recordRefresh(
		sessionId: string,
		refreshTokenHash: string,
		lastActivityAt: Date,
	): Promise<void> {
		// One write for both fields, and `updateMany` instead of `update`: the
		// caller already read the row, and a row removed in between must make
		// this a no-op rather than throw P2025 and turn a refresh into a 500.
		await this.prisma.session.updateMany({
			where: { id: sessionId },
			data: { lastActivityAt, refreshTokenHash },
		});
	}

	async revoke(sessionId: string, revokedAt: Date): Promise<void> {
		// Same reason as `touch`, plus idempotence: a second logout must not
		// rewrite the tombstone timestamp or fail.
		await this.prisma.session.updateMany({
			where: { id: sessionId, revokedAt: null },
			data: { revokedAt },
		});
	}

	private static toEntity(row: {
		id: string;
		userId: string;
		createdAt: Date;
		lastActivityAt: Date;
		refreshTokenHash: string;
		revokedAt: Date | null;
	}): Session {
		return Session.create({
			id: row.id,
			userId: row.userId,
			createdAt: row.createdAt,
			lastActivityAt: row.lastActivityAt,
			refreshTokenHash: row.refreshTokenHash,
			revokedAt: row.revokedAt,
		});
	}
}
