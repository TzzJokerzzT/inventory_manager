import request from "supertest";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { createRequireAuth } from "../src/interfaces/http/middlewares/require-auth.js";
import {
	generateRsaKeyPair,
	type LocalIssuer,
	startLocalIssuer,
	TEST_AUDIENCE,
} from "./support/local-jwks-issuer.js";

describe("requireAuth on the company routes", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const companyRepository = new InMemoryCompanyRepository();

		return buildApp({
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
		});
	}

	it("accepts a request with a valid token and round-trips the payload", async () => {
		const response = await request(createTestApp())
			.post("/companies")
			.set("authorization", `Bearer ${issuer.signToken()}`)
			.send({ name: "Acme" });

		expect(response.status).toBe(201);
		expect(response.body.name).toBe("Acme");
		expect(typeof response.body.id).toBe("string");
	});

	it("rejects a request without a token", async () => {
		const response = await request(createTestApp())
			.post("/companies")
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({
			error: { message: expect.any(String) },
		});
	});

	it("adds a WWW-Authenticate challenge to the 401 response", async () => {
		const response = await request(createTestApp())
			.post("/companies")
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
		// Assert the scheme, not the full string: the library owns the realm and
		// error details and may evolve them.
		expect(response.headers["www-authenticate"]).toMatch(/^Bearer\b/);
	});

	it("rejects a malformed token", async () => {
		const response = await request(createTestApp())
			.post("/companies")
			.set("authorization", "Bearer not-a-real-jwt")
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({
			error: { message: expect.any(String) },
		});
	});

	it("rejects a token signed with another key", async () => {
		const otherKey = generateRsaKeyPair();
		const token = issuer.signWithKey(otherKey.privateKey, issuer.kid);

		const response = await request(createTestApp())
			.post("/companies")
			.set("authorization", `Bearer ${token}`)
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
	});

	it("rejects an expired token", async () => {
		const token = issuer.signToken({
			exp: Math.floor(Date.now() / 1000) - 3600,
		});

		const response = await request(createTestApp())
			.post("/companies")
			.set("authorization", `Bearer ${token}`)
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
	});

	it("rejects a token with the wrong audience", async () => {
		const token = issuer.signToken({ aud: "https://another-api" });

		const response = await request(createTestApp())
			.post("/companies")
			.set("authorization", `Bearer ${token}`)
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
	});

	it("rejects a token with the wrong issuer", async () => {
		const token = issuer.signToken({ iss: "http://127.0.0.1:1/" });

		const response = await request(createTestApp())
			.post("/companies")
			.set("authorization", `Bearer ${token}`)
			.send({ name: "Acme" });

		expect(response.status).toBe(401);
	});

	it("keeps /health public", async () => {
		const response = await request(createTestApp()).get("/health");

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ status: "ok" });
	});
});
