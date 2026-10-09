import request from "supertest";
import { CreateCompanyUseCase } from "../src/application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "../src/application/use-cases/list-companies.js";
import { Company } from "../src/domain/entities/company.js";
import { Membership } from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { CloudinaryUploadSigner } from "../src/infrastructure/storage/cloudinary-upload-signer.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { createRequireAuth } from "../src/interfaces/http/middlewares/require-auth.js";
import { createRequireCompanyContext } from "../src/interfaces/http/middlewares/require-company-context.js";
import { createRequireUser } from "../src/interfaces/http/middlewares/require-user.js";
import { createFakeUserRepository } from "./support/fake-user-repository.js";
import {
	type LocalIssuer,
	startLocalIssuer,
	TEST_AUDIENCE,
} from "./support/local-jwks-issuer.js";

const TEST_WEB_ORIGIN = "http://localhost:3000";
const FIXED_TIMESTAMP_MS = 1_700_000_000_000;
const EXPECTED_TIMESTAMP = Math.floor(FIXED_TIMESTAMP_MS / 1000);
const FAKE_API_SECRET = "SUPERSECRET-API-SECRET";

type Sign = (
	paramsToSign: Record<string, unknown>,
	apiSecret: string,
) => string;

describe("POST /companies/:companyId/media/signature", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	async function createTestApp() {
		const companyRepository = new InMemoryCompanyRepository();
		const membershipRepository = new InMemoryMembershipRepository();

		const owner = User.create({
			auth0Sub: "auth0|owner",
			email: "owner@example.com",
		});
		const outsider = User.create({
			auth0Sub: "auth0|outsider",
			email: "outsider@example.com",
		});
		const userRepository = createFakeUserRepository([owner, outsider]);

		const company = Company.create({ name: "Acme" });
		await companyRepository.createOwnedBy(company, {
			userId: owner.id,
			email: owner.email,
		});

		// Seed the owner's ACTIVE membership so `requireCompanyContext` resolves
		// it, exactly as the context endpoint does.
		membershipRepository.save(
			Membership.create({
				userId: owner.id,
				invitedEmail: owner.email,
				companyId: company.id,
				role: "OWNER",
				status: "ACTIVE",
				invitedBy: owner.id,
				acceptedAt: new Date(),
			}),
		);

		// The real Cloudinary SDK's signing function is injected as a fake, so
		// this test never calls the real account. The fake records what the
		// adapter asked it to sign and returns a fixed signature.
		const sign = jest.fn<Sign>().mockReturnValue("fixed-signature");
		const mediaUploadSigner = new CloudinaryUploadSigner({
			cloudName: "demo-cloud",
			apiKey: "123456789012345",
			apiSecret: FAKE_API_SECRET,
			sign,
			now: () => FIXED_TIMESTAMP_MS,
		});

		const app = buildApp({
			createCompany: new CreateCompanyUseCase({ companyRepository }),
			listCompanies: new ListCompaniesUseCase({ companyRepository }),
			loginWithCredentials: {} as never,
			registerUser: {} as never,
			refreshSession: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: createRequireCompanyContext({
				membershipRepository,
			}),
			mediaUploadSigner,
			authCookieOptions: {
				httpOnly: true,
				secure: false,
				sameSite: "lax",
				path: "/auth",
				maxAge: 30 * 24 * 60 * 60 * 1000,
			},
			corsOrigin: TEST_WEB_ORIGIN,
		});

		return { app, company, owner, outsider, sign };
	}

	function authorization(user: User): string {
		return `Bearer ${issuer.signToken({ sub: user.auth0Sub })}`;
	}

	it("signs for a member and returns the parameters plus the size contract, never the secret", async () => {
		const { app, company, owner } = await createTestApp();

		const response = await request(app)
			.post(`/companies/${company.id}/media/signature`)
			.set("authorization", authorization(owner))
			.send({});

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			cloudName: "demo-cloud",
			apiKey: "123456789012345",
			timestamp: EXPECTED_TIMESTAMP,
			signature: "fixed-signature",
			folder: `companies/${company.id}`,
			allowedFormats: ["jpg", "png", "webp"],
			maxFileSizeBytes: 5_242_880,
		});
		expect(response.body).not.toHaveProperty("apiSecret");
		expect(response.text).not.toContain(FAKE_API_SECRET);
	});

	it("answers the same uniform 403 for a non-member as the context endpoint", async () => {
		const { app, company, outsider, sign } = await createTestApp();

		const nonMemberSignature = await request(app)
			.post(`/companies/${company.id}/media/signature`)
			.set("authorization", authorization(outsider))
			.send({});
		const nonMemberContext = await request(app)
			.get(`/companies/${company.id}/context`)
			.set("authorization", authorization(outsider));

		expect(nonMemberSignature.status).toBe(403);
		expect(nonMemberContext.status).toBe(403);
		expect(nonMemberSignature.body).toEqual(nonMemberContext.body);
		// Fail closed before the signer: a denied request must not sign anything.
		expect(sign).not.toHaveBeenCalled();
	});

	it("still answers 401 for an unauthenticated request (requireAuth runs first)", async () => {
		const { app, company, sign } = await createTestApp();

		const response = await request(app).post(
			`/companies/${company.id}/media/signature`,
		);

		expect(response.status).toBe(401);
		expect(sign).not.toHaveBeenCalled();
	});

	it("ignores a body that tries to inject folder, formats, timestamp or extra parameters", async () => {
		const { app, company, owner, sign } = await createTestApp();

		const response = await request(app)
			.post(`/companies/${company.id}/media/signature`)
			.set("authorization", authorization(owner))
			.send({
				folder: "attacker-controlled-folder",
				allowedFormats: ["svg", "exe"],
				timestamp: 0,
				apiKey: "attacker-controlled-key",
				extra: "unexpected",
			});

		expect(response.status).toBe(200);
		expect(sign).toHaveBeenCalledTimes(1);
		expect(sign).toHaveBeenCalledWith(
			{
				folder: `companies/${company.id}`,
				timestamp: EXPECTED_TIMESTAMP,
				allowed_formats: "jpg,png,webp",
			},
			FAKE_API_SECRET,
		);
		expect(response.body.folder).toBe(`companies/${company.id}`);
		expect(response.body.allowedFormats).toEqual(["jpg", "png", "webp"]);
		expect(response.body.timestamp).toBe(EXPECTED_TIMESTAMP);
		expect(response.body).not.toHaveProperty("extra");
		expect(response.text).not.toContain("attacker-controlled-folder");
	});

	it("signs with the injected sign function, never the real Cloudinary account", async () => {
		const { app, company, owner, sign } = await createTestApp();

		const response = await request(app)
			.post(`/companies/${company.id}/media/signature`)
			.set("authorization", authorization(owner))
			.send({});

		expect(response.status).toBe(200);
		// The signature is the fake's fixed return value, not a string the real
		// Cloudinary account produced: the injected function is the only signer.
		expect(response.body.signature).toBe("fixed-signature");
		expect(sign).toHaveBeenCalledTimes(1);
	});
});
