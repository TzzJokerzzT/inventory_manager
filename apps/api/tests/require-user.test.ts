import express from "express";
import request from "supertest";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { errorHandler } from "../src/interfaces/http/middlewares/error-handler.js";
import { createRequireAuth } from "../src/interfaces/http/middlewares/require-auth.js";
import { createRequireUser } from "../src/interfaces/http/middlewares/require-user.js";
import {
	createFakeUserRepository,
	TEST_SUB,
} from "./support/fake-user-repository.js";
import {
	type LocalIssuer,
	startLocalIssuer,
	TEST_AUDIENCE,
} from "./support/local-jwks-issuer.js";

const TEST_WEB_ORIGIN = "http://localhost:3000";

describe("requireUser", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function authorization(sub?: string): string {
		return `Bearer ${issuer.signToken(sub === undefined ? {} : { sub })}`;
	}

	describe("on the company routes", () => {
		function createTestApp(users: User[]) {
			const companyRepository = new InMemoryCompanyRepository();
			const userRepository = createFakeUserRepository(users);

			return buildApp({
				createCompany: new CreateCompanyUseCase({ companyRepository }),
				listCompanies: new ListCompaniesUseCase({ companyRepository }),
				refreshSession: {} as never,
				requireAuth: createRequireAuth({
					issuerBaseURL: issuer.issuerBaseURL,
					audience: TEST_AUDIENCE,
				}),
				requireUser: createRequireUser({ userRepository }),
				corsOrigin: TEST_WEB_ORIGIN,
			});
		}

		it("resolves the token sub to a user and lets the request through", async () => {
			const owner = User.create({
				auth0Sub: TEST_SUB,
				email: "owner@example.com",
			});

			const response = await request(createTestApp([owner]))
				.post("/companies")
				.set("authorization", authorization())
				.send({ name: "Acme" });

			expect(response.status).toBe(201);
			expect(response.body.name).toBe("Acme");
		});

		it("answers 403 user_not_provisioned when the token is valid but no row exists", async () => {
			const response = await request(createTestApp([]))
				.post("/companies")
				.set("authorization", authorization())
				.send({ name: "Acme" });

			expect(response.status).toBe(403);
			expect(response.body).toMatchObject({
				error: {
					message: "User not provisioned",
					code: "user_not_provisioned",
				},
			});
		});

		it("does not run before requireAuth: an unauthenticated request is still 401", async () => {
			const response = await request(createTestApp([]))
				.post("/companies")
				.send({ name: "Acme" });

			expect(response.status).toBe(401);
			expect(response.body).toMatchObject({
				error: { message: expect.any(String) },
			});
		});
	});

	describe("attaching the resolved user", () => {
		it("puts the user on the request for downstream handlers", async () => {
			const owner = User.create({
				auth0Sub: TEST_SUB,
				email: "owner@example.com",
			});
			const userRepository = createFakeUserRepository([owner]);

			const app = express();
			app.get(
				"/whoami",
				createRequireAuth({
					issuerBaseURL: issuer.issuerBaseURL,
					audience: TEST_AUDIENCE,
				}),
				createRequireUser({ userRepository }),
				(request, response) => {
					response.json({ id: request.user?.id, email: request.user?.email });
				},
			);
			app.use(errorHandler);

			const response = await request(app)
				.get("/whoami")
				.set("authorization", authorization());

			expect(response.status).toBe(200);
			expect(response.body).toMatchObject({
				id: owner.id,
				email: "owner@example.com",
			});
		});
	});
});
