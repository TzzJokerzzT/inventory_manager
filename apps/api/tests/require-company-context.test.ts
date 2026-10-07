import express from "express";
import request from "supertest";
import {
	type CreateMembershipProps,
	Membership,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { errorHandler } from "../src/interfaces/http/middlewares/error-handler.js";
import { createRequireCompanyContext } from "../src/interfaces/http/middlewares/require-company-context.js";

const COMPANY_ID = "5f0b8a3c-2c5f-4d1e-9e8a-7b6c5d4e3f2a";
const USER_ID = "user-1";

function createTestApp(memberships: Membership[]) {
	const membershipRepository = new InMemoryMembershipRepository(memberships);

	const app = express();
	app.get(
		"/companies/:companyId/context",
		(request, _response, next) => {
			// `requireUser` runs before this middleware on the real routes; here
			// the resolved user is simulated so the middleware under test gets
			// exactly the request it expects.
			request.user = User.create({
				auth0Sub: "auth0|user",
				email: "user@example.com",
				id: USER_ID,
			});
			next();
		},
		createRequireCompanyContext({ membershipRepository }),
		(request, response) => {
			response.json(request.companyContext);
		},
	);
	app.use(errorHandler);

	return app;
}

function membership(
	overrides: Partial<CreateMembershipProps> = {},
): Membership {
	return Membership.create({
		userId: USER_ID,
		invitedEmail: "user@example.com",
		companyId: COMPANY_ID,
		role: "MEMBER",
		status: "ACTIVE",
		invitedBy: "owner-1",
		acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	});
}

describe("requireCompanyContext", () => {
	// Coverage note: the integration happy path in `company-context.test.ts`
	// only exercises the OWNER role, because the in-memory company and
	// membership stores only agree on bootstrap OWNER memberships. MEMBER and
	// ADMIN role resolution is therefore proven here, at the middleware level
	// only.
	it("resolves an ACTIVE membership into { companyId, role }", async () => {
		const memberApp = createTestApp([membership()]);
		const adminApp = createTestApp([membership({ role: "ADMIN" })]);

		const memberResponse = await request(memberApp).get(
			`/companies/${COMPANY_ID}/context`,
		);
		const adminResponse = await request(adminApp).get(
			`/companies/${COMPANY_ID}/context`,
		);

		expect(memberResponse.status).toBe(200);
		expect(memberResponse.body).toEqual({
			companyId: COMPANY_ID,
			role: "MEMBER",
		});
		expect(adminResponse.status).toBe(200);
		expect(adminResponse.body).toEqual({
			companyId: COMPANY_ID,
			role: "ADMIN",
		});
	});

	it("answers the same uniform 403 body for a non-member and a non-existent company", async () => {
		const app = createTestApp([]);

		const nonMember = await request(app).get(
			`/companies/${COMPANY_ID}/context`,
		);
		const nonExistent = await request(app).get(
			"/companies/00000000-0000-4000-8000-000000000000/context",
		);

		expect(nonMember.status).toBe(403);
		expect(nonExistent.status).toBe(403);
		expect(nonMember.body).toEqual(nonExistent.body);
	});

	it("answers 403 for a REVOKED membership", async () => {
		const app = createTestApp([membership({ status: "REVOKED" })]);

		const response = await request(app).get(`/companies/${COMPANY_ID}/context`);

		expect(response.status).toBe(403);
	});

	it("answers 403 for an INVITED membership", async () => {
		const app = createTestApp([
			membership({ status: "INVITED", acceptedAt: null }),
		]);

		const response = await request(app).get(`/companies/${COMPANY_ID}/context`);

		expect(response.status).toBe(403);
	});

	it("answers 400 for an invalid company id format", async () => {
		const app = createTestApp([]);

		const response = await request(app).get("/companies/not-a-uuid/context");

		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			error: { message: "Invalid company id" },
		});
	});
});
