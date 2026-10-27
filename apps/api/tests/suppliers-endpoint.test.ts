import request from "supertest";
import { CreateSupplierUseCase } from "../src/application/use-cases/create-supplier.js";
import { DeleteSupplierUseCase } from "../src/application/use-cases/delete-supplier.js";
import { ListSuppliersUseCase } from "../src/application/use-cases/list-suppliers.js";
import { UpdateSupplierUseCase } from "../src/application/use-cases/update-supplier.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { InMemorySupplierRepository } from "../src/infrastructure/database/in-memory-supplier-repository.js";
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

const MISSING_SUPPLIER_ID = "12345678-1234-4123-8123-123456789012";

describe("supplier endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const membershipRepository = new InMemoryMembershipRepository();
		const supplierRepository = new InMemorySupplierRepository();
		// The roster summarizes every supplier with its latest lot (L12), so the
		// reads share one product store and one lot store.
		const productRepository = new InMemoryProductRepository();
		const stockLotRepository = new InMemoryStockLotRepository(
			new InMemoryStockMovementRepository(new Map()),
		);

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
			customers: {} as never,
			products: {} as never,
			suppliers: {
				list: new ListSuppliersUseCase({
					supplierRepository,
					stockLotRepository,
					productRepository,
				}),
				create: new CreateSupplierUseCase({ supplierRepository }),
				update: new UpdateSupplierUseCase({ supplierRepository }),
				remove: new DeleteSupplierUseCase({ supplierRepository }),
			},
			categories: {} as never,
			lots: {} as never,
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

	async function createSupplier(
		app: ReturnType<typeof createTestApp>["app"],
		overrides: Record<string, unknown> = {},
		as: string = OWNER_SUB,
	): Promise<Record<string, unknown>> {
		const response = await request(app)
			.post(`/companies/${COMPANY}/suppliers`)
			.set("authorization", authorization(as))
			.send({ name: "Distribuidora Sur", contact: "Juan Perez", ...overrides });

		expect(response.status).toBe(201);

		return response.body;
	}

	async function listNames(
		app: ReturnType<typeof createTestApp>["app"],
	): Promise<string[]> {
		const response = await request(app)
			.get(`/companies/${COMPANY}/suppliers`)
			.set("authorization", authorization(OWNER_SUB));

		expect(response.status).toBe(200);

		return response.body.map((supplier: { name: string }) => supplier.name);
	}

	describe("POST /companies/:companyId/suppliers", () => {
		it("creates a supplier and answers 201 with the contract shape", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "  Distribuidora Sur  ", contact: "  Juan Perez  " });

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				id: expect.any(String),
				companyId: COMPANY,
				name: "Distribuidora Sur",
				contact: "Juan Perez",
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			});
		});

		it("stores a blank contact as null", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Sur", contact: "   " });

			expect(response.status).toBe(201);
			expect(response.body.contact).toBeNull();
		});

		it("lets an ADMIN create, because writing is `manage_products`", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const body = await createSupplier(app, {}, ADMIN_SUB);

			expect(body.name).toBe("Distribuidora Sur");
		});

		it("answers 403 insufficient_role for a MEMBER and stores nothing", async () => {
			// S6: a MEMBER reads the catalogue; writes are OWNER and ADMIN only.
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ name: "Distribuidora Sur" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
			expect(await listNames(app)).toEqual([]);
		});

		it("answers 409 supplier_name_already_exists and keeps the first row", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createSupplier(app);

			const response = await request(app)
				.post(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Sur" });

			expect(response.status).toBe(409);
			expect(response.body.error).toEqual({
				message: "A supplier with that name already exists in the company",
				code: "supplier_name_already_exists",
			});
			expect(await listNames(app)).toEqual(["Distribuidora Sur"]);
		});

		it.each([
			["a missing name", { name: undefined }],
			["an empty name", { name: "   " }],
			["a name over 120 characters", { name: "a".repeat(121) }],
			["a contact over 120 characters", { contact: "a".repeat(121) }],
		])("answers 400 with issues for %s", async (_label, overrides) => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Sur", ...overrides });

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
			expect(await listNames(app)).toEqual([]);
		});

		it("answers 400 for a malformed company id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post("/companies/not-a-uuid/suppliers")
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Sur" });

			expect(response.status).toBe(400);
		});

		it("answers 401 without a token and 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const withoutToken = await request(app).post(
				`/companies/${COMPANY}/suppliers`,
			);
			const outsider = await request(app)
				.post(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OUTSIDER_SUB))
				.send({ name: "Distribuidora Sur" });

			expect(withoutToken.status).toBe(401);
			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("GET /companies/:companyId/suppliers", () => {
		it("lists the company's suppliers ordered by name and then id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createSupplier(app, { name: "Zeta" });
			await createSupplier(app, { name: "Alfa" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map((supplier: { name: string }) => supplier.name),
			).toEqual(["Alfa", "Zeta"]);
		});

		it("never lists another company's suppliers", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			// The same OWNER belongs to both companies, so only the company filter
			// separates the two rosters.
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			await createSupplier(app, { name: "Propio" });
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/suppliers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno" });

			expect(foreign.status).toBe(201);
			expect(await listNames(app)).toEqual(["Propio"]);
		});

		it("answers 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("PATCH /companies/:companyId/suppliers/:supplierId", () => {
		it("updates the given fields and keeps the untouched ones", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(ADMIN_SUB))
				.send({ name: "  Distribuidora Norte  " });

			expect(response.status).toBe(200);
			expect(response.body).toMatchObject({
				id: supplier.id,
				companyId: COMPANY,
				name: "Distribuidora Norte",
				contact: "Juan Perez",
			});
		});

		it("clears the contact with an explicit null", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ contact: null });

			expect(response.status).toBe(200);
			expect(response.body.contact).toBeNull();
		});

		it("answers 409 supplier_name_already_exists and keeps the old name", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createSupplier(app, { name: "Distribuidora Sur" });
			const second = await createSupplier(app, {
				name: "Distribuidora Norte",
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/${second.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Sur" });

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("supplier_name_already_exists");
			expect(await listNames(app)).toEqual([
				"Distribuidora Norte",
				"Distribuidora Sur",
			]);
		});

		it("answers 403 insufficient_role for a MEMBER and keeps the row", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ name: "Distribuidora Norte" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
			expect(await listNames(app)).toEqual(["Distribuidora Sur"]);
		});

		it("answers 404 supplier_not_found for a soft-deleted supplier", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			await request(app)
				.delete(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Norte" });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("supplier_not_found");
		});

		it("answers 404 supplier_not_found for a supplier that does not exist", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/${MISSING_SUPPLIER_ID}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Norte" });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("supplier_not_found");
		});

		it("answers 400 for an invalid body and for a malformed supplier id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			const badBody = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "   " });
			const badId = await request(app)
				.patch(`/companies/${COMPANY}/suppliers/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Norte" });

			expect(badBody.status).toBe(400);
			expect(badId.status).toBe(400);
			expect(await listNames(app)).toEqual(["Distribuidora Sur"]);
		});
	});

	describe("DELETE /companies/:companyId/suppliers/:supplierId", () => {
		it("soft-deletes and answers 204, then the supplier is gone from the list", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			const deleted = await request(app)
				.delete(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(ADMIN_SUB));

			expect(deleted.status).toBe(204);
			expect(deleted.text).toBe("");
			expect(await listNames(app)).toEqual([]);
		});

		it("keeps the name reserved, so reusing it answers 409", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			await request(app)
				.delete(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(OWNER_SUB));
			const response = await request(app)
				.post(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Distribuidora Sur" });

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("supplier_name_already_exists");
			expect(await listNames(app)).toEqual([]);
		});

		it("answers 404 supplier_not_found on a second delete", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			await request(app)
				.delete(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(OWNER_SUB));
			const second = await request(app)
				.delete(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(second.status).toBe(404);
			expect(second.body.error.code).toBe("supplier_not_found");
		});

		it("answers 403 insufficient_role for a MEMBER and keeps the row", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			const response = await request(app)
				.delete(`/companies/${COMPANY}/suppliers/${supplier.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
			expect(await listNames(app)).toEqual(["Distribuidora Sur"]);
		});

		it("answers 401 without a token and 400 for a malformed supplier id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const supplier = await createSupplier(app);

			const withoutToken = await request(app).delete(
				`/companies/${COMPANY}/suppliers/${supplier.id}`,
			);
			const badId = await request(app)
				.delete(`/companies/${COMPANY}/suppliers/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB));

			expect(withoutToken.status).toBe(401);
			expect(badId.status).toBe(400);
			expect(await listNames(app)).toEqual(["Distribuidora Sur"]);
		});
	});
});
