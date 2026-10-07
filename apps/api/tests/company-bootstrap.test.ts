import express from "express";
import request from "supertest";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { createCompanyController } from "../src/interfaces/http/controllers/company-controller.js";
import { errorHandler } from "../src/interfaces/http/middlewares/error-handler.js";
import { createRequireAuth } from "../src/interfaces/http/middlewares/require-auth.js";
import { createRequireUser } from "../src/interfaces/http/middlewares/require-user.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";
import {
	type LocalIssuer,
	startLocalIssuer,
	TEST_AUDIENCE,
} from "./support/local-jwks-issuer.js";

const TEST_WEB_ORIGIN = "http://localhost:3000";

describe("company bootstrap", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const companyRepository = new InMemoryCompanyRepository();
		const owner = User.create({
			auth0Sub: "auth0|owner",
			email: "Owner@Example.com",
		});
		const other = User.create({
			auth0Sub: "auth0|other",
			email: "other@example.com",
		});
		const userRepository = createFakeUserRepository([owner, other]);

		const app = buildApp({
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return { app, companyRepository, owner, other };
	}

	it("creates a company owned by the caller with an OWNER/ACTIVE membership", async () => {
		const { app, companyRepository, owner } = createTestApp();

		const response = await request(app)
			.post("/companies")
			.set(
				"authorization",
				`Bearer ${issuer.signToken({ sub: owner.auth0Sub })}`,
			)
			.send({ name: "Acme" });

		expect(response.status).toBe(201);
		expect(response.body.name).toBe("Acme");

		const memberships = companyRepository.listMemberships();
		expect(memberships).toHaveLength(1);
		expect(memberships[0]).toMatchObject({
			userId: owner.id,
			companyId: response.body.id,
			role: "OWNER",
			status: "ACTIVE",
			invitedEmail: "owner@example.com",
			invitedBy: owner.id,
		});
	});

	it("lists only the caller's companies, never another user's", async () => {
		const { app, owner, other } = createTestApp();

		await request(app)
			.post("/companies")
			.set(
				"authorization",
				`Bearer ${issuer.signToken({ sub: owner.auth0Sub })}`,
			)
			.send({ name: "Acme" });
		await request(app)
			.post("/companies")
			.set(
				"authorization",
				`Bearer ${issuer.signToken({ sub: other.auth0Sub })}`,
			)
			.send({ name: "Globex" });

		const ownList = await request(app)
			.get("/companies")
			.set(
				"authorization",
				`Bearer ${issuer.signToken({ sub: owner.auth0Sub })}`,
			);

		expect(ownList.status).toBe(200);
		expect(ownList.body).toHaveLength(1);
		expect(ownList.body[0]).toMatchObject({ name: "Acme" });

		const otherList = await request(app)
			.get("/companies")
			.set(
				"authorization",
				`Bearer ${issuer.signToken({ sub: other.auth0Sub })}`,
			);

		expect(otherList.status).toBe(200);
		expect(otherList.body).toHaveLength(1);
		expect(otherList.body[0]).toMatchObject({ name: "Globex" });
	});

	it("fails loudly instead of inventing a user when requireUser did not run", async () => {
		const companyRepository = new InMemoryCompanyRepository();
		const controller = createCompanyController({
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
		});

		// Deliberately no requireAuth/requireUser: the controller must fail on
		// its own rather than manufacture an owner.
		const app = express();
		app.use(express.json());
		app.post("/companies", controller.create);
		app.use(errorHandler);

		const response = await request(app)
			.post("/companies")
			.send({ name: "Acme" });

		expect(response.status).toBe(500);
	});
});
