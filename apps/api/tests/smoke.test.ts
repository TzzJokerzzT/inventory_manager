import request from "supertest";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
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

describe("smoke", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const companyRepository = new InMemoryCompanyRepository();
		const userRepository = createFakeUserRepository([
			User.create({ auth0Sub: TEST_SUB, email: "owner@example.com" }),
		]);

		return buildApp({
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
			refreshSession: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: (_request, _response, next) => next(),
			corsOrigin: TEST_WEB_ORIGIN,
		});
	}

	describe("GET /health", () => {
		it("returns 200 with a JSON status payload", async () => {
			const response = await request(createTestApp()).get("/health");

			expect(response.status).toBe(200);
			expect(response.headers["content-type"]).toContain("application/json");
			expect(response.body).toMatchObject({ status: "ok" });
		});
	});

	describe("company slice", () => {
		it("creates a company and lists it back", async () => {
			const app = createTestApp();
			const authorization = `Bearer ${issuer.signToken()}`;

			const created = await request(app)
				.post("/companies")
				.set("authorization", authorization)
				.send({ name: "Acme" });

			expect(created.status).toBe(201);
			expect(created.body.name).toBe("Acme");
			expect(typeof created.body.id).toBe("string");

			const listed = await request(app)
				.get("/companies")
				.set("authorization", authorization);

			expect(listed.status).toBe(200);
			expect(listed.body).toHaveLength(1);
			expect(listed.body[0]).toMatchObject({
				id: created.body.id,
				name: "Acme",
			});
		});

		it("rejects a company with a blank name", async () => {
			const response = await request(createTestApp())
				.post("/companies")
				.set("authorization", `Bearer ${issuer.signToken()}`)
				.send({ name: "   " });

			expect(response.status).toBe(400);
		});

		it("returns 404 for unknown routes", async () => {
			const response = await request(createTestApp()).get("/unknown");

			expect(response.status).toBe(404);
		});
	});
});
