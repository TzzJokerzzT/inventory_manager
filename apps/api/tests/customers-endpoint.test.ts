import request from "supertest";
import { CreateCustomerUseCase } from "../src/application/use-cases/create-customer.js";
import { DeleteCustomerUseCase } from "../src/application/use-cases/delete-customer.js";
import { GetCustomerUseCase } from "../src/application/use-cases/get-customer.js";
import { ListCustomersUseCase } from "../src/application/use-cases/list-customers.js";
import { UpdateCustomerUseCase } from "../src/application/use-cases/update-customer.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryCustomerRepository } from "../src/infrastructure/database/in-memory-customer-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
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
const COMPANY = "11111111-2222-4333-8444-555555555555";
const OTHER_COMPANY = "99999999-8888-4777-8666-555555555555";

const OWNER_SUB = "auth0|owner";
const ADMIN_SUB = "auth0|admin";
const MEMBER_SUB = "auth0|member";
const OUTSIDER_SUB = "auth0|outsider";

const MISSING_CUSTOMER_ID = "12345678-1234-4123-8123-123456789012";

describe("customer endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const membershipRepository = new InMemoryMembershipRepository();
		const customerRepository = new InMemoryCustomerRepository();

		const owner = User.create({ auth0Sub: OWNER_SUB, email: "owner@x.com" });
		const admin = User.create({ auth0Sub: ADMIN_SUB, email: "admin@x.com" });
		const member = User.create({ auth0Sub: MEMBER_SUB, email: "member@x.com" });
		const outsider = User.create({
			auth0Sub: OUTSIDER_SUB,
			email: "outsider@x.com",
		});
		const userRepository = createFakeUserRepository([
			owner,
			admin,
			member,
			outsider,
		]);

		function seedMembership(options: {
			userId: string;
			role: MembershipRole;
			companyId?: string;
		}): void {
			membershipRepository.save(
				Membership.create({
					userId: options.userId,
					invitedEmail: "someone@x.com",
					companyId: options.companyId ?? COMPANY,
					role: options.role,
					status: "ACTIVE",
					invitedBy: owner.id,
					acceptedAt: new Date(),
				}),
			);
		}

		const companyRepository = new InMemoryCompanyRepository();
		companyRepository.save(Company.create({ id: COMPANY, name: "Acme" }));
		companyRepository.save(
			Company.create({ id: OTHER_COMPANY, name: "Globex" }),
		);

		const app = buildApp({
			acceptInvitations: {} as never,
			changeMemberRole: {} as never,
			createCompany: {} as never,
			getCurrentUser: {} as never,
			inviteMember: {} as never,
			leaveCompany: {} as never,
			listCompanies: {} as never,
			listMembers: {} as never,
			listNotifications: {} as never,
			listPendingInvitations: {} as never,
			markNotificationsRead: {} as never,
			revokeMember: {} as never,
			loginWithCredentials: {} as never,
			registerUser: {} as never,
			refreshSession: {} as never,
			startSession: {} as never,
			resumeSession: {} as never,
			endSession: {} as never,
			updateUserFullName: {} as never,
			customers: {
				list: new ListCustomersUseCase({ customerRepository }),
				create: new CreateCustomerUseCase({ customerRepository }),
				get: new GetCustomerUseCase({ customerRepository }),
				update: new UpdateCustomerUseCase({ customerRepository }),
				remove: new DeleteCustomerUseCase({ customerRepository }),
			},
			products: {} as never,
			requireAuth: createRequireAuth({
				issuerBaseURL: issuer.issuerBaseURL,
				audience: TEST_AUDIENCE,
			}),
			requireUser: createRequireUser({ userRepository }),
			requireCompanyContext: createRequireCompanyContext({
				membershipRepository,
				companyRepository,
			}),
			mediaUploadSigner: {} as never,
			movements: {} as never,
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
			owner,
			admin,
			member,
			outsider,
			customerRepository,
			seedMembership,
			seedRoster: () => {
				seedMembership({ userId: owner.id, role: "OWNER" });
				seedMembership({ userId: admin.id, role: "ADMIN" });
				seedMembership({ userId: member.id, role: "MEMBER" });
			},
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	async function createCustomer(
		app: ReturnType<typeof createTestApp>["app"],
		overrides: Record<string, unknown> = {},
		as: string = OWNER_SUB,
	): Promise<Record<string, unknown>> {
		const response = await request(app)
			.post(`/companies/${COMPANY}/customers`)
			.set("authorization", authorization(as))
			.send({
				name: "Maria Gonzalez",
				email: "maria@example.com",
				phone: "+54 11 5555-1234",
				address: "Av. Siempre Viva 742",
				...overrides,
			});

		expect(response.status).toBe(201);

		return response.body;
	}

	describe("POST /companies/:companyId/customers", () => {
		it("creates a customer and answers 201 with the contract shape", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					name: "  Maria Gonzalez  ",
					email: "  Maria.Gonzalez@Example.COM ",
					phone: " +54 11 5555-1234 ",
					address: " Av. Siempre Viva 742 ",
				});

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				id: expect.any(String),
				companyId: COMPANY,
				name: "Maria Gonzalez",
				email: "maria.gonzalez@example.com",
				phone: "+54 11 5555-1234",
				address: "Av. Siempre Viva 742",
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			});
		});

		it("stores the contact fields as null when they are absent or blank", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					name: "Maria Gonzalez",
					email: "   ",
					phone: "",
					address: null,
				});

			expect(response.status).toBe(201);
			expect(response.body).toMatchObject({
				email: null,
				phone: null,
				address: null,
			});
		});

		it.each([
			["a MEMBER", MEMBER_SUB],
			["an ADMIN", ADMIN_SUB],
		])("lets %s create, because every active role writes", async (_l, sub) => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const body = await createCustomer(app, {}, sub);

			expect(body.name).toBe("Maria Gonzalez");
		});

		it("accepts a second customer with the same email", async () => {
			// L4: no unique index on the email, so no 409 to answer.
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createCustomer(app);

			const response = await request(app)
				.post(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Maria II", email: "MARIA@example.com" });

			expect(response.status).toBe(201);
			expect(response.body.email).toBe("maria@example.com");
		});

		it.each([
			["a missing name", { name: undefined }],
			["an empty name", { name: "   " }],
			["a name over 120 characters", { name: "a".repeat(121) }],
			["an invalid email", { email: "not-an-email" }],
			["an email over 254 characters", { email: `${"a".repeat(250)}@b.co` }],
			["a phone with letters", { phone: "555-CALL-NOW" }],
			["a phone over 40 characters", { phone: "1".repeat(41) }],
			["an address over 300 characters", { address: "a".repeat(301) }],
		])("answers 400 with issues for %s", async (_label, overrides) => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Maria Gonzalez", ...overrides });

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});

		it("answers 400 for a malformed company id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post("/companies/not-a-uuid/customers")
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Maria Gonzalez" });

			expect(response.status).toBe(400);
		});

		it("answers 401 without a token and 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const withoutToken = await request(app).post(
				`/companies/${COMPANY}/customers`,
			);
			const outsider = await request(app)
				.post(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OUTSIDER_SUB))
				.send({ name: "Maria Gonzalez" });

			expect(withoutToken.status).toBe(401);
			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("GET /companies/:companyId/customers", () => {
		it("lists the company's customers ordered by name and then id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createCustomer(app, { name: "Zoe" });
			await createCustomer(app, { name: "Ana" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map((customer: { name: string }) => customer.name),
			).toEqual(["Ana", "Zoe"]);
		});

		it("searches by name, email or phone, case-insensitively", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createCustomer(app, {
				name: "Maria Gonzalez",
				email: "maria@example.com",
				phone: "+54 11 5555-1234",
			});
			await createCustomer(app, {
				name: "Zoe",
				email: "zoe@other.com",
				phone: "+54 11 4444-0000",
			});

			const byName = await request(app)
				.get(`/companies/${COMPANY}/customers?search=GONZALEZ`)
				.set("authorization", authorization(OWNER_SUB));
			const byEmail = await request(app)
				.get(`/companies/${COMPANY}/customers?search=example.com`)
				.set("authorization", authorization(OWNER_SUB));
			const byPhone = await request(app)
				.get(`/companies/${COMPANY}/customers?search=5555`)
				.set("authorization", authorization(OWNER_SUB));

			expect(byName.body.map((row: { name: string }) => row.name)).toEqual([
				"Maria Gonzalez",
			]);
			expect(byEmail.body.map((row: { name: string }) => row.name)).toEqual([
				"Maria Gonzalez",
			]);
			expect(byPhone.body.map((row: { name: string }) => row.name)).toEqual([
				"Maria Gonzalez",
			]);
		});

		it("never lists another company's customers", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			// The same OWNER belongs to both companies, so only the company filter
			// separates the two rosters.
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			await createCustomer(app, { name: "Propio" });
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB));

			expect(foreign.status).toBe(201);
			expect(response.body.map((row: { name: string }) => row.name)).toEqual([
				"Propio",
			]);
		});

		it("answers 400 when the search is longer than 100 characters", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers?search=${"a".repeat(101)}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});

		it("answers 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("GET /companies/:companyId/customers/:customerId", () => {
		it("reads one customer for any member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toEqual(customer);
		});

		it("answers 404 customer_not_found for another company's customer", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers/${foreign.body.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(foreign.status).toBe(201);
			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("customer_not_found");
		});

		it("answers 404 customer_not_found for a customer that does not exist", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers/${MISSING_CUSTOMER_ID}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("customer_not_found");
		});

		it("answers 400 for a malformed customer id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/customers/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
		});
	});

	describe("PATCH /companies/:companyId/customers/:customerId", () => {
		it("updates the given fields and keeps the untouched ones", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ name: "  Maria G.  " });

			expect(response.status).toBe(200);
			expect(response.body).toMatchObject({
				id: customer.id,
				companyId: COMPANY,
				name: "Maria G.",
				email: "maria@example.com",
				phone: "+54 11 5555-1234",
				address: "Av. Siempre Viva 742",
			});
		});

		it("clears a contact field with an explicit null", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ email: null, phone: null, address: null });

			expect(response.status).toBe(200);
			expect(response.body.email).toBeNull();
			expect(response.body.phone).toBeNull();
			expect(response.body.address).toBeNull();
		});

		it("clears a contact field with an empty string", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ email: "   " });

			expect(response.status).toBe(200);
			expect(response.body.email).toBeNull();
		});

		it("answers 404 customer_not_found for a soft-deleted customer", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			await request(app)
				.delete(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.patch(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Maria G." });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("customer_not_found");
		});

		it("answers 404 customer_not_found for another company's customer", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno" });

			const response = await request(app)
				.patch(`/companies/${COMPANY}/customers/${foreign.body.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Maria G." });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("customer_not_found");
		});

		it("answers 400 for an invalid body and for a malformed customer id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			const badBody = await request(app)
				.patch(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ email: "not-an-email" });
			const badId = await request(app)
				.patch(`/companies/${COMPANY}/customers/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Maria G." });

			expect(badBody.status).toBe(400);
			expect(badId.status).toBe(400);
		});
	});

	describe("DELETE /companies/:companyId/customers/:customerId", () => {
		it("soft-deletes and answers 204, then the customer is gone from every read", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			const deleted = await request(app)
				.delete(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(MEMBER_SUB));
			const read = await request(app)
				.get(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB));
			const list = await request(app)
				.get(`/companies/${COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB));

			expect(deleted.status).toBe(204);
			expect(deleted.text).toBe("");
			expect(read.status).toBe(404);
			expect(list.body).toEqual([]);
		});

		it("answers 404 customer_not_found on a second delete", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			await request(app)
				.delete(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB));
			const second = await request(app)
				.delete(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(second.status).toBe(404);
			expect(second.body.error.code).toBe("customer_not_found");
		});

		it("answers 404 customer_not_found for another company's customer", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/customers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno" });

			const response = await request(app)
				.delete(`/companies/${COMPANY}/customers/${foreign.body.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("customer_not_found");
		});

		it("answers 400 for a malformed customer id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.delete(`/companies/${COMPANY}/customers/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
		});

		it("answers 403 for a non-member and 401 without a token", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const customer = await createCustomer(app);

			const outsider = await request(app)
				.delete(`/companies/${COMPANY}/customers/${customer.id}`)
				.set("authorization", authorization(OUTSIDER_SUB));
			const withoutToken = await request(app).delete(
				`/companies/${COMPANY}/customers/${customer.id}`,
			);

			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
			expect(withoutToken.status).toBe(401);
		});
	});
});
