import request from "supertest";
import { ListNotificationsUseCase } from "../src/application/use-cases/list-notifications.js";
import { MarkNotificationsReadUseCase } from "../src/application/use-cases/mark-notifications-read.js";
import { Company } from "../src/domain/entities/company.js";
import { Notification } from "../src/domain/entities/notification.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryNotificationRepository } from "../src/infrastructure/database/in-memory-notification-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { createRequireAuth } from "../src/interfaces/http/middlewares/require-auth.js";
import { createRequireUser } from "../src/interfaces/http/middlewares/require-user.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";
import {
	type LocalIssuer,
	startLocalIssuer,
	TEST_AUDIENCE,
} from "./support/local-jwks-issuer.js";

const TEST_WEB_ORIGIN = "http://localhost:3000";
const CALLER_SUB = "auth0|caller";
const CALLER_EMAIL = "caller@example.com";
const CREATED_AT = new Date("2026-01-02T03:04:05.000Z");
const COMPANY_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

describe("me notifications endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	async function createTestApp() {
		const companyRepository = new InMemoryCompanyRepository();
		const notificationRepository = new InMemoryNotificationRepository();

		const caller = User.create({
			auth0Sub: CALLER_SUB,
			email: CALLER_EMAIL,
		});
		const other = User.create({
			auth0Sub: "auth0|other",
			email: "other@example.com",
		});
		const userRepository = createFakeUserRepository([caller, other]);

		const company = Company.create({
			id: "company-a",
			name: "Acme",
			createdAt: COMPANY_CREATED_AT,
		});
		await companyRepository.createOwnedBy(company, {
			userId: caller.id,
			email: caller.email,
		});

		const app = buildApp({
			listNotifications: new ListNotificationsUseCase({
				companyRepository,
				notificationRepository,
				userRepository,
			}),
			markNotificationsRead: new MarkNotificationsReadUseCase({
				notificationRepository,
			}),
			acceptInvitations: {} as never,
			createCompany: {} as never,
			changeMemberRole: {} as never,
			getCurrentUser: {} as never,
			inviteMember: {} as never,
			leaveCompany: {} as never,
			listCompanies: {} as never,
			listMembers: {} as never,
			listPendingInvitations: {} as never,
			revokeMember: {} as never,
			loginWithCredentials: {} as never,
			registerUser: {} as never,
			refreshSession: {} as never,
			updateUserFullName: {} as never,
			mediaUploadSigner: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: (_request, _response, next) => next(),
			authCookieOptions: {
				httpOnly: true,
				secure: false,
				sameSite: "lax",
				path: "/auth",
				maxAge: 30 * 24 * 60 * 60 * 1000,
			},
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return {
			app,
			caller,
			other,
			company,
			companyRepository,
			notificationRepository,
		};
	}

	function seedNotification(
		repository: InMemoryNotificationRepository,
		overrides: {
			id: string;
			userId: string;
			companyId?: string;
			actorId?: string;
			readAt?: Date | null;
		},
	): Notification {
		const payload: Record<string, unknown> = {
			membershipId: `membership-${overrides.id}`,
		};
		if (overrides.companyId) {
			payload.companyId = overrides.companyId;
		}
		if (overrides.actorId) {
			payload.actorId = overrides.actorId;
		}

		const notification = Notification.create({
			id: overrides.id,
			userId: overrides.userId,
			type: "membership.accepted",
			payload,
			dedupeKey: `membership.accepted:${overrides.id}`,
			readAt: overrides.readAt ?? null,
			createdAt: CREATED_AT,
		});
		repository.save(notification);
		return notification;
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	it("answers 200 with the caller's notification shape", async () => {
		const { app, caller, notificationRepository } = await createTestApp();
		seedNotification(notificationRepository, {
			id: "notification-a",
			userId: caller.id,
			companyId: "company-a",
		});

		const response = await request(app)
			.get("/me/notifications")
			.set("authorization", authorization(caller.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([
			{
				id: "notification-a",
				type: "membership.accepted",
				createdAt: CREATED_AT.toISOString(),
				readAt: null,
				company: {
					id: "company-a",
					name: "Acme",
					createdAt: COMPANY_CREATED_AT.toISOString(),
				},
				actor: null,
			},
		]);
		// Storage details the reader does not need must not leak onto the wire.
		expect(response.body[0]).not.toHaveProperty("payload");
		expect(response.body[0]).not.toHaveProperty("dedupeKey");
	});

	it("answers 200 with an empty array when there is no news", async () => {
		const { app, caller } = await createTestApp();

		const response = await request(app)
			.get("/me/notifications")
			.set("authorization", authorization(caller.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("answers company null without hiding the event when the company does not resolve", async () => {
		const { app, caller, notificationRepository } = await createTestApp();
		seedNotification(notificationRepository, {
			id: "notification-ghost",
			userId: caller.id,
			companyId: "company-ghost",
		});

		const response = await request(app)
			.get("/me/notifications")
			.set("authorization", authorization(caller.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body).toHaveLength(1);
		expect(response.body[0].company).toBeNull();
	});

	it("names the actor who triggered the event", async () => {
		const { app, caller, other, notificationRepository } =
			await createTestApp();
		seedNotification(notificationRepository, {
			id: "notification-actor",
			userId: caller.id,
			companyId: "company-a",
			actorId: other.id,
		});

		const response = await request(app)
			.get("/me/notifications")
			.set("authorization", authorization(caller.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body[0].actor).toEqual({
			id: other.id,
			fullName: other.fullName,
			email: other.email,
		});
	});

	it("never returns another user's notifications", async () => {
		const { app, caller, other, notificationRepository } =
			await createTestApp();
		seedNotification(notificationRepository, {
			id: "mine",
			userId: caller.id,
			companyId: "company-a",
		});
		seedNotification(notificationRepository, {
			id: "theirs",
			userId: other.id,
			companyId: "company-a",
		});

		const response = await request(app)
			.get("/me/notifications")
			.set("authorization", authorization(caller.auth0Sub));

		expect(response.status).toBe(200);
		expect(response.body.map((item: { id: string }) => item.id)).toEqual([
			"mine",
		]);
	});

	it("answers 401 without a token", async () => {
		const { app } = await createTestApp();

		const response = await request(app).get("/me/notifications");

		expect(response.status).toBe(401);
	});

	it("answers 403 user_not_provisioned when the token resolves to no users row", async () => {
		const { app } = await createTestApp();

		const response = await request(app)
			.get("/me/notifications")
			.set("authorization", authorization("auth0|unknown"));

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			error: { message: "User not provisioned", code: "user_not_provisioned" },
		});
	});

	it("marks all the caller's notifications read and answers 204", async () => {
		const { app, caller, notificationRepository } = await createTestApp();
		seedNotification(notificationRepository, {
			id: "notification-a",
			userId: caller.id,
			companyId: "company-a",
		});

		const response = await request(app)
			.post("/me/notifications/read")
			.set("authorization", authorization(caller.auth0Sub))
			.send({});

		expect(response.status).toBe(204);
		expect(response.body).toEqual({});

		const stored = await notificationRepository.findByUser(caller.id);
		expect(stored[0]?.readAt).not.toBeNull();
	});

	it("never marks another user's notifications read", async () => {
		const { app, caller, other, notificationRepository } =
			await createTestApp();
		seedNotification(notificationRepository, {
			id: "mine",
			userId: caller.id,
			companyId: "company-a",
		});
		seedNotification(notificationRepository, {
			id: "theirs",
			userId: other.id,
			companyId: "company-a",
		});

		await request(app)
			.post("/me/notifications/read")
			.set("authorization", authorization(caller.auth0Sub))
			.send({});

		const theirs = await notificationRepository.findByUser(other.id);
		expect(theirs[0]?.readAt).toBeNull();
	});

	it("answers 401 on the read action without a token", async () => {
		const { app } = await createTestApp();

		const response = await request(app).post("/me/notifications/read").send({});

		expect(response.status).toBe(401);
	});

	it("answers 403 user_not_provisioned on the read action when the user is missing", async () => {
		const { app } = await createTestApp();

		const response = await request(app)
			.post("/me/notifications/read")
			.set("authorization", authorization("auth0|unknown"))
			.send({});

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			error: { message: "User not provisioned", code: "user_not_provisioned" },
		});
	});
});
