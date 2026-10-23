import { hashRefreshToken } from "../src/application/session-token-hash.js";
import { EndSessionUseCase } from "../src/application/use-cases/end-session.js";
import { ResumeSessionUseCase } from "../src/application/use-cases/resume-session.js";
import { StartSessionUseCase } from "../src/application/use-cases/start-session.js";
import { Session } from "../src/domain/entities/session.js";
import { SessionInvalidError } from "../src/domain/errors/session-invalid-error.js";
import { InMemorySessionRepository } from "../src/infrastructure/database/in-memory-session-repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const REFRESH_TOKEN = "refresh-token-value";
const ROTATED_REFRESH_TOKEN = "rotated-refresh-token-value";
const IDLE_TIMEOUT_MS = 5_000;

/** A clock a test moves by hand, so no assertion depends on wall time. */
function fixedClock(start: Date) {
	let current = start;
	return {
		now: () => current,
		advanceTo: (next: Date) => {
			current = next;
		},
	};
}

describe("Session entity", () => {
	const createdAt = new Date("2026-01-01T00:00:00.000Z");
	const hash = hashRefreshToken(REFRESH_TOKEN);

	it("is not expired one millisecond before the window closes", () => {
		const session = Session.create({
			userId: USER_ID,
			createdAt,
			refreshTokenHash: hash,
		});

		expect(
			session.isExpiredAt(
				new Date(createdAt.getTime() + IDLE_TIMEOUT_MS - 1),
				IDLE_TIMEOUT_MS,
			),
		).toBe(false);
	});

	it("is expired exactly at the window boundary and after it", () => {
		const session = Session.create({
			userId: USER_ID,
			createdAt,
			refreshTokenHash: hash,
		});

		expect(
			session.isExpiredAt(
				new Date(createdAt.getTime() + IDLE_TIMEOUT_MS),
				IDLE_TIMEOUT_MS,
			),
		).toBe(true);
		expect(
			session.isExpiredAt(
				new Date(createdAt.getTime() + IDLE_TIMEOUT_MS * 2),
				IDLE_TIMEOUT_MS,
			),
		).toBe(true);
	});

	it("treats a revoked session as expired no matter how recent its activity is", () => {
		const revoked = Session.create({
			userId: USER_ID,
			createdAt,
			refreshTokenHash: hash,
			revokedAt: createdAt,
		});

		expect(revoked.isExpiredAt(createdAt, IDLE_TIMEOUT_MS)).toBe(true);
	});

	it("only matches the refresh token it was issued for", () => {
		const session = Session.create({
			userId: USER_ID,
			createdAt,
			refreshTokenHash: hash,
		});

		expect(session.matchesRefreshTokenHash(hash)).toBe(true);
		expect(
			session.matchesRefreshTokenHash(hashRefreshToken("another-token")),
		).toBe(false);
	});

	it("keeps the first revocation timestamp when revoked twice", () => {
		const session = Session.create({
			userId: USER_ID,
			createdAt,
			refreshTokenHash: hash,
		});
		const first = session.revoke(new Date("2026-01-02T00:00:00.000Z"));
		const second = first.revoke(new Date("2026-01-03T00:00:00.000Z"));

		expect(second.revokedAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));
	});
});

describe("StartSessionUseCase", () => {
	it("persists a session bound to the token, active as of its creation", async () => {
		const repository = new InMemorySessionRepository();
		const now = new Date("2026-01-01T00:00:00.000Z");
		const useCase = new StartSessionUseCase({
			sessionRepository: repository,
			clock: () => now,
		});

		const session = await useCase.execute({
			userId: USER_ID,
			refreshToken: REFRESH_TOKEN,
		});

		expect(session.userId).toBe(USER_ID);
		expect(session.createdAt).toEqual(now);
		expect(session.lastActivityAt).toEqual(now);
		// The token itself is never persisted, only its digest.
		expect(session.refreshTokenHash).toBe(hashRefreshToken(REFRESH_TOKEN));
		expect(JSON.stringify(session.toJSON())).not.toContain(REFRESH_TOKEN);
		expect(await repository.findById(session.id)).not.toBeNull();
	});
});

describe("ResumeSessionUseCase", () => {
	const createdAt = new Date("2026-01-01T00:00:00.000Z");

	function build(options: { session?: Session; now: Date }) {
		const repository = new InMemorySessionRepository(
			options.session === undefined ? [] : [options.session],
		);
		const useCase = new ResumeSessionUseCase({
			sessionRepository: repository,
			idleTimeoutMs: IDLE_TIMEOUT_MS,
			clock: () => options.now,
		});

		return { repository, useCase };
	}

	function session(
		overrides: Partial<Parameters<typeof Session.create>[0]> = {},
	) {
		return Session.create({
			id: SESSION_ID,
			userId: USER_ID,
			createdAt,
			refreshTokenHash: hashRefreshToken(REFRESH_TOKEN),
			...overrides,
		});
	}

	it("accepts a live session presenting the token it was issued for", async () => {
		const { repository, useCase } = build({
			session: session(),
			now: new Date(createdAt.getTime() + IDLE_TIMEOUT_MS - 1),
		});

		await expect(
			useCase.execute({ sessionId: SESSION_ID, refreshToken: REFRESH_TOKEN }),
		).resolves.toBeUndefined();
		// The gate only reads: a refresh that fails afterwards must not look like
		// activity, so nothing is written here.
		expect((await repository.findById(SESSION_ID))?.lastActivityAt).toEqual(
			createdAt,
		);
	});

	it("rejects a token that does not belong to this session, without writing", async () => {
		// The attack the digest closes: a stolen token paired with somebody
		// else's live session id.
		const { repository, useCase } = build({
			session: session(),
			now: createdAt,
		});

		await expect(
			useCase.execute({
				sessionId: SESSION_ID,
				refreshToken: "stolen-token",
			}),
		).rejects.toThrow(SessionInvalidError);
		expect((await repository.findById(SESSION_ID))?.lastActivityAt).toEqual(
			createdAt,
		);
	});

	it("rejects an unknown session with the uniform session error", async () => {
		const { useCase } = build({ now: createdAt });

		await expect(
			useCase.execute({ sessionId: SESSION_ID, refreshToken: REFRESH_TOKEN }),
		).rejects.toThrow(SessionInvalidError);
	});

	it("rejects a session idle for the whole window", async () => {
		const { useCase } = build({
			session: session(),
			now: new Date(createdAt.getTime() + IDLE_TIMEOUT_MS),
		});

		await expect(
			useCase.execute({ sessionId: SESSION_ID, refreshToken: REFRESH_TOKEN }),
		).rejects.toThrow(SessionInvalidError);
	});

	it("rejects a revoked session even when it was used a moment ago", async () => {
		const { useCase } = build({
			session: session({ revokedAt: createdAt }),
			now: createdAt,
		});

		await expect(
			useCase.execute({ sessionId: SESSION_ID, refreshToken: REFRESH_TOKEN }),
		).rejects.toThrow(SessionInvalidError);
	});

	it("records a completed refresh: activity forward and the rotated digest", async () => {
		const later = new Date(createdAt.getTime() + IDLE_TIMEOUT_MS - 1);
		const { repository, useCase } = build({ session: session(), now: later });

		await useCase.recordRefresh({
			sessionId: SESSION_ID,
			refreshToken: ROTATED_REFRESH_TOKEN,
		});

		const stored = await repository.findById(SESSION_ID);
		expect(stored?.lastActivityAt).toEqual(later);
		// The provider rotated the token, so the row must now expect the new one
		// and stop accepting the old one.
		expect(
			stored?.matchesRefreshTokenHash(hashRefreshToken(ROTATED_REFRESH_TOKEN)),
		).toBe(true);
		expect(
			stored?.matchesRefreshTokenHash(hashRefreshToken(REFRESH_TOKEN)),
		).toBe(false);
	});
});

describe("EndSessionUseCase", () => {
	const createdAt = new Date("2026-01-01T00:00:00.000Z");

	function session() {
		return Session.create({
			id: SESSION_ID,
			userId: USER_ID,
			createdAt,
			refreshTokenHash: hashRefreshToken(REFRESH_TOKEN),
		});
	}

	it("tombstones the session with the time it was signed out", async () => {
		const repository = new InMemorySessionRepository([session()]);
		const signedOutAt = new Date("2026-01-01T00:05:00.000Z");
		const useCase = new EndSessionUseCase({
			sessionRepository: repository,
			clock: () => signedOutAt,
		});

		await useCase.execute({ sessionId: SESSION_ID });

		expect((await repository.findById(SESSION_ID))?.revokedAt).toEqual(
			signedOutAt,
		);
	});

	it("is idempotent: a second logout keeps the first timestamp", async () => {
		const repository = new InMemorySessionRepository([session()]);
		const clock = fixedClock(new Date("2026-01-01T00:05:00.000Z"));
		const useCase = new EndSessionUseCase({
			sessionRepository: repository,
			clock: clock.now,
		});

		await useCase.execute({ sessionId: SESSION_ID });
		clock.advanceTo(new Date("2026-01-01T00:10:00.000Z"));
		await useCase.execute({ sessionId: SESSION_ID });

		expect((await repository.findById(SESSION_ID))?.revokedAt).toEqual(
			new Date("2026-01-01T00:05:00.000Z"),
		);
	});

	it("resolves without throwing for an unknown session", async () => {
		const useCase = new EndSessionUseCase({
			sessionRepository: new InMemorySessionRepository(),
			clock: () => createdAt,
		});

		await expect(
			useCase.execute({ sessionId: SESSION_ID }),
		).resolves.toBeUndefined();
	});
});
