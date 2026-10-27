import request from "supertest";
import { RegisterLotUseCase } from "../src/application/use-cases/register-lot.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { Supplier } from "../src/domain/entities/supplier.js";
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
const PRODUCT_ID = "22222222-3333-4444-8555-666666666666";
const OTHER_PRODUCT_ID = "33333333-4444-4555-8666-777777777777";
const SUPPLIER_ID = "44444444-5555-4666-8777-888888888888";
const MISSING_ID = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";

const OWNER_SUB = "auth0|owner";
const ADMIN_SUB = "auth0|admin";
const MEMBER_SUB = "auth0|member";
const OUTSIDER_SUB = "auth0|outsider";

describe("lot endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const membershipRepository = new InMemoryMembershipRepository();
		const companyRepository = new InMemoryCompanyRepository();
		const supplierRepository = new InMemorySupplierRepository();
		// One shared store: the ledger, the products and the lots read the same
		// state, which is what the database is in production.
		const store = new Map<string, Product>();
		const productRepository = new InMemoryProductRepository([], store);
		const stockMovementRepository = new InMemoryStockMovementRepository(store);
		const stockLotRepository = new InMemoryStockLotRepository(
			stockMovementRepository,
		);

		productRepository.save(
			Product.create({
				id: PRODUCT_ID,
				companyId: COMPANY,
				name: "Rollo plastico",
				sku: "ROLLO",
				price: "9000",
			}),
		);
		productRepository.save(
			Product.create({
				id: OTHER_PRODUCT_ID,
				companyId: OTHER_COMPANY,
				name: "Rollo ajeno",
				sku: "AJENO",
				price: "9000",
			}),
		);
		supplierRepository.save(
			Supplier.create({
				id: SUPPLIER_ID,
				companyId: COMPANY,
				name: "Distribuidora Sur",
			}),
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
			movements: {} as never,
			suppliers: {} as never,
			categories: {} as never,
			lots: {
				register: new RegisterLotUseCase({
					productRepository,
					supplierRepository,
					stockLotRepository,
				}),
			},
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
			store,
			stockMovementRepository,
			stockLotRepository,
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

	function body(overrides: Record<string, unknown> = {}) {
		return {
			productId: PRODUCT_ID,
			supplierId: SUPPLIER_ID,
			costPerMeasure: "1234.56",
			measures: [1.111, 1.111, 1.111],
			note: "Factura 1234",
			...overrides,
		};
	}

	describe("POST /companies/:companyId/lots", () => {
		it("registers the lot and answers 201 with the derived totals", async () => {
			const { app, store, stockMovementRepository, seedRoster } =
				createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(OWNER_SUB))
				.send(body());

			expect(response.status).toBe(201);
			expect(response.body).toMatchObject({
				id: expect.any(String),
				companyId: COMPANY,
				productId: PRODUCT_ID,
				supplierId: SUPPLIER_ID,
				receivedAt: expect.any(String),
				measureTotal: "3.333",
				costPerMeasure: "1234.56",
				unitCount: 3,
				note: "Factura 1234",
				createdAt: expect.any(String),
				units: [
					{
						id: expect.any(String),
						code: "R-01",
						measure: "1.111",
						cost: "1371.60",
						status: "AVAILABLE",
					},
					{
						id: expect.any(String),
						code: "R-02",
						measure: "1.111",
						cost: "1371.60",
						status: "AVAILABLE",
					},
					{
						id: expect.any(String),
						code: "R-03",
						measure: "1.111",
						cost: "1371.59",
						status: "AVAILABLE",
					},
				],
			});

			// S8: the ledger counts the units the lot brought in.
			expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(3);
			const movements = await stockMovementRepository.findByCompany(COMPANY, {
				limit: 10,
			});
			expect(movements).toHaveLength(1);
			expect(movements[0]).toMatchObject({
				type: "IN",
				quantity: 3,
				lotId: response.body.id,
			});
		});

		it("lets an ADMIN register, because writing is `manage_products`", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(ADMIN_SUB))
				.send(body());

			expect(response.status).toBe(201);
		});

		it("answers 400 measure_total_derived when the body carries a measureTotal", async () => {
			const { app, seedRoster, stockLotRepository, store } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(OWNER_SUB))
				.send(body({ measureTotal: "3.333" }));

			expect(response.status).toBe(400);
			expect(response.body.error.code).toBe("measure_total_derived");
			expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
			expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
		});

		it.each([
			["an empty list of measures", { measures: [] }],
			["a non-positive measure", { measures: [1, 0] }],
			["a measure with more than three decimals", { measures: [1.1111] }],
			["a cost per measure of zero", { costPerMeasure: "0.00" }],
			[
				"a cost per measure that is not a decimal string",
				{ costPerMeasure: 5 },
			],
			["a product id that is not a uuid", { productId: "not-a-uuid" }],
		])("answers 400 for %s", async (_label, overrides) => {
			const { app, seedRoster, stockLotRepository, store } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(OWNER_SUB))
				.send(body(overrides));

			expect(response.status).toBe(400);
			expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
			expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
		});

		it("answers 403 insufficient_role for a MEMBER and stores nothing", async () => {
			const {
				app,
				seedRoster,
				stockLotRepository,
				stockMovementRepository,
				store,
			} = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(MEMBER_SUB))
				.send(body());

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
			expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
			expect(
				await stockMovementRepository.findByCompany(COMPANY, { limit: 10 }),
			).toEqual([]);
			expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
		});

		it("answers 404 product_not_found for a foreign product and leaves the state untouched", async () => {
			// The rejected request must not leave a lot row, a movement or a stock
			// change behind (L7).
			const {
				app,
				seedRoster,
				stockLotRepository,
				stockMovementRepository,
				store,
			} = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(OWNER_SUB))
				.send(body({ productId: OTHER_PRODUCT_ID }));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
			expect(stockLotRepository.listByCompany(COMPANY)).toEqual([]);
			expect(
				await stockMovementRepository.findByCompany(COMPANY, { limit: 10 }),
			).toEqual([]);
			expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
			expect(store.get(OTHER_PRODUCT_ID)?.stockQuantity).toBe(0);
		});

		it("answers 404 supplier_not_found for a supplier that does not exist", async () => {
			const { app, seedRoster, store } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(OWNER_SUB))
				.send(body({ supplierId: MISSING_ID }));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("supplier_not_found");
			expect(store.get(PRODUCT_ID)?.stockQuantity).toBe(0);
		});

		it("answers 401 without a token and 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const withoutToken = await request(app).post(
				`/companies/${COMPANY}/lots`,
			);
			const outsider = await request(app)
				.post(`/companies/${COMPANY}/lots`)
				.set("authorization", authorization(OUTSIDER_SUB))
				.send(body());

			expect(withoutToken.status).toBe(401);
			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
		});

		it("answers 400 for a malformed company id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post("/companies/not-a-uuid/lots")
				.set("authorization", authorization(OWNER_SUB))
				.send(body());

			expect(response.status).toBe(400);
		});
	});
});
