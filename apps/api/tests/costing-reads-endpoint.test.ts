import request from "supertest";
import { GetProductUseCase } from "../src/application/use-cases/get-product.js";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { ListSuppliersUseCase } from "../src/application/use-cases/list-suppliers.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { StockLot } from "../src/domain/entities/stock-lot.js";
import { Supplier } from "../src/domain/entities/supplier.js";
import { User } from "../src/domain/entities/user.js";
import { COMPANY_CONTEXT_FORBIDDEN_CODE } from "../src/domain/errors/company-context-forbidden-error.js";
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
const SUPPLIER_A = "44444444-5555-4666-8777-888888888888";
const SUPPLIER_B = "55555555-6666-4777-8888-999999999999";
const SUPPLIER_WITHOUT_LOTS = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const USER_ID = "88888888-9999-4aaa-8bbb-cccccccccccc";

const OWNER_SUB = "auth0|owner";
const ADMIN_SUB = "auth0|admin";
const MEMBER_SUB = "auth0|member";
const OUTSIDER_SUB = "auth0|outsider";

const RECEIVED_AT = new Date("2026-10-21T12:00:00.000Z");

/**
 * The three reads of the cost slice (L11, L12) exercised through HTTP: the
 * movement margin was already covered by its own suite, and what this one
 * proves is that the product and supplier reads answer the derived values with
 * the contract's shape, behind the same auth and company context as the rest of
 * the API, and that reading them writes nothing.
 */
describe("costing endpoints", () => {
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
		// One shared store, like the database: the products, the ledger and the
		// lot reads see the same state.
		const store = new Map<string, Product>();
		const productRepository = new InMemoryProductRepository([], store);
		const stockMovementRepository = new InMemoryStockMovementRepository(store);
		const stockLotRepository = new InMemoryStockLotRepository(
			stockMovementRepository,
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

		function seedRoster(): void {
			seedMembership({ userId: owner.id, role: "OWNER" });
			seedMembership({ userId: admin.id, role: "ADMIN" });
			seedMembership({ userId: member.id, role: "MEMBER" });
		}

		companyRepository.save(Company.create({ id: COMPANY, name: "Acme" }));
		companyRepository.save(
			Company.create({ id: OTHER_COMPANY, name: "Globex" }),
		);

		function seedSupplier(id: string, name: string): Supplier {
			const supplier = Supplier.create({ id, companyId: COMPANY, name });
			supplierRepository.save(supplier);

			return supplier;
		}

		function seedProduct(): Product {
			const product = Product.create({
				id: PRODUCT_ID,
				companyId: COMPANY,
				name: "Rollo plastico",
				sku: "ROLLO",
				price: "9000.00",
			});
			productRepository.save(product);

			return product;
		}

		async function seedLot(options: {
			id: string;
			supplierId: string;
			costPerMeasure: string;
			measures: number[];
			receivedAt: Date;
		}): Promise<StockLot> {
			const lot = StockLot.create({
				id: options.id,
				companyId: COMPANY,
				productId: PRODUCT_ID,
				supplierId: options.supplierId,
				costPerMeasure: options.costPerMeasure,
				measures: options.measures,
				receivedAt: options.receivedAt,
				createdAt: options.receivedAt,
			});

			return stockLotRepository.register(lot, USER_ID);
		}

		/**
		 * Everything a read could write, so "the reads write nothing" is a
		 * comparison of observable state instead of an assumption.
		 */
		async function snapshot() {
			return {
				lots: stockLotRepository
					.listByCompany(COMPANY)
					.map((lot) => lot.toJSON()),
				products: await productRepository.list(COMPANY),
				movements: await stockMovementRepository.findByCompany(COMPANY, {
					limit: 200,
				}),
			};
		}

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
			products: {
				list: new ListProductsUseCase({
					productRepository,
					stockLotRepository,
				}),
				get: new GetProductUseCase({
					productRepository,
					stockLotRepository,
					supplierRepository,
				}),
				create: {} as never,
				update: {} as never,
				remove: {} as never,
				restore: {} as never,
				purge: {} as never,
			},
			suppliers: {
				list: new ListSuppliersUseCase({
					supplierRepository,
					stockLotRepository,
					productRepository,
				}),
				create: {} as never,
				update: {} as never,
				remove: {} as never,
			},
			customers: {} as never,
			movements: {} as never,
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
			seedRoster,
			seedSupplier,
			seedProduct,
			seedLot,
			snapshot,
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	describe("GET /companies/:companyId/products", () => {
		it("derives the cost fields of each row from its available units", async () => {
			const { app, seedRoster, seedSupplier, seedProduct, seedLot } =
				createTestApp();
			seedRoster();
			seedProduct();
			seedSupplier(SUPPLIER_A, "Distribuidora Sur");
			await seedLot({
				id: "lot-1",
				supplierId: SUPPLIER_A,
				costPerMeasure: "5900.00",
				measures: [4, 6],
				receivedAt: RECEIVED_AT,
			});

			const response = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toHaveLength(1);
			expect(response.body[0]).toMatchObject({
				id: PRODUCT_ID,
				price: "9000.00",
				availableUnits: 2,
				availableMeasure: "10.000",
				costPerMeasure: "5900.00",
				unitCost: "29500.00",
				marginPerUnit: "-20500.00",
			});
			// The list does not load lots: that is the detail's answer.
			expect(response.body[0]).not.toHaveProperty("lots");
		});

		it("answers 401 without a token and 403 for a company the caller is not in", async () => {
			const { app, seedRoster, seedProduct } = createTestApp();
			seedRoster();
			seedProduct();

			const unauthenticated = await request(app).get(
				`/companies/${COMPANY}/products`,
			);
			const foreign = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(unauthenticated.status).toBe(401);
			expect(foreign.status).toBe(403);
			expect(foreign.body).toMatchObject({
				error: { code: COMPANY_CONTEXT_FORBIDDEN_CODE },
			});
		});
	});

	describe("GET /companies/:companyId/products/:productId", () => {
		it("answers the derived costs and the latest lots with their supplier", async () => {
			const { app, seedRoster, seedSupplier, seedProduct, seedLot } =
				createTestApp();
			seedRoster();
			seedProduct();
			seedSupplier(SUPPLIER_A, "Distribuidora Sur");
			seedSupplier(SUPPLIER_B, "Plasticos Norte");
			await seedLot({
				id: "lot-old",
				supplierId: SUPPLIER_A,
				costPerMeasure: "5650.00",
				measures: [5, 5],
				receivedAt: new Date("2026-10-01T12:00:00.000Z"),
			});
			await seedLot({
				id: "lot-new",
				supplierId: SUPPLIER_B,
				costPerMeasure: "5900.00",
				measures: [5, 5],
				receivedAt: RECEIVED_AT,
			});

			const response = await request(app)
				.get(`/companies/${COMPANY}/products/${PRODUCT_ID}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toMatchObject({
				id: PRODUCT_ID,
				availableUnits: 4,
				availableMeasure: "20.000",
				costPerMeasure: "5775.00",
				unitCost: "28875.00",
				marginPerUnit: "-19875.00",
			});
			// Newest first: the comparison "which supplier should I buy from".
			expect(response.body.lots.map((lot: { id: string }) => lot.id)).toEqual([
				"lot-new",
				"lot-old",
			]);
			expect(response.body.lots[0]).toEqual({
				id: "lot-new",
				supplierId: SUPPLIER_B,
				supplierName: "Plasticos Norte",
				receivedAt: RECEIVED_AT.toISOString(),
				measureTotal: "10.000",
				costPerMeasure: "5900.00",
				unitCount: 2,
				availableUnits: 2,
			});
		});

		it("answers 401 without a token and 403 for a company the caller is not in", async () => {
			const { app, seedRoster, seedProduct } = createTestApp();
			seedRoster();
			seedProduct();

			const unauthenticated = await request(app).get(
				`/companies/${COMPANY}/products/${PRODUCT_ID}`,
			);
			const foreign = await request(app)
				.get(`/companies/${COMPANY}/products/${PRODUCT_ID}`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(unauthenticated.status).toBe(401);
			expect(foreign.status).toBe(403);
		});
	});

	describe("GET /companies/:companyId/suppliers", () => {
		it("summarizes each supplier with its latest lot", async () => {
			const { app, seedRoster, seedSupplier, seedProduct, seedLot } =
				createTestApp();
			seedRoster();
			seedProduct();
			seedSupplier(SUPPLIER_A, "Distribuidora Sur");
			seedSupplier(SUPPLIER_WITHOUT_LOTS, "Sin compras");
			await seedLot({
				id: "lot-old",
				supplierId: SUPPLIER_A,
				costPerMeasure: "5650.00",
				measures: [5],
				receivedAt: new Date("2026-10-01T12:00:00.000Z"),
			});
			await seedLot({
				id: "lot-new",
				supplierId: SUPPLIER_A,
				costPerMeasure: "5900.00",
				measures: [5],
				receivedAt: RECEIVED_AT,
			});

			const response = await request(app)
				.get(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);

			const byName = new Map(
				response.body.map((row: { name: string }) => [row.name, row]),
			);

			expect(byName.get("Distribuidora Sur")).toMatchObject({
				id: SUPPLIER_A,
				lastLot: {
					id: "lot-new",
					productId: PRODUCT_ID,
					productName: "Rollo plastico",
					costPerMeasure: "5900.00",
					measureUnit: "KILOGRAM",
					receivedAt: RECEIVED_AT.toISOString(),
				},
			});
			expect(byName.get("Sin compras")).toMatchObject({ lastLot: null });
		});

		it("answers 401 without a token and 403 for a company the caller is not in", async () => {
			const { app, seedRoster, seedSupplier } = createTestApp();
			seedRoster();
			seedSupplier(SUPPLIER_A, "Distribuidora Sur");

			const unauthenticated = await request(app).get(
				`/companies/${COMPANY}/suppliers`,
			);
			const foreign = await request(app)
				.get(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(unauthenticated.status).toBe(401);
			expect(foreign.status).toBe(403);
		});
	});

	it("writes nothing when the three reads answer", async () => {
		const { app, seedRoster, seedSupplier, seedProduct, seedLot, snapshot } =
			createTestApp();
		seedRoster();
		seedProduct();
		seedSupplier(SUPPLIER_A, "Distribuidora Sur");
		await seedLot({
			id: "lot-1",
			supplierId: SUPPLIER_A,
			costPerMeasure: "5900.00",
			measures: [4, 6],
			receivedAt: RECEIVED_AT,
		});

		const before = await snapshot();

		const responses = await Promise.all([
			request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB)),
			request(app)
				.get(`/companies/${COMPANY}/products/${PRODUCT_ID}`)
				.set("authorization", authorization(MEMBER_SUB)),
			request(app)
				.get(`/companies/${COMPANY}/suppliers`)
				.set("authorization", authorization(MEMBER_SUB)),
		]);

		expect(responses.map((response) => response.status)).toEqual([
			200, 200, 200,
		]);
		await expect(snapshot()).resolves.toEqual(before);
	});
});
