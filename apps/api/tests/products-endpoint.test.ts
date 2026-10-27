import request from "supertest";
import { CreateProductUseCase } from "../src/application/use-cases/create-product.js";
import { DeleteProductUseCase } from "../src/application/use-cases/delete-product.js";
import { GetProductUseCase } from "../src/application/use-cases/get-product.js";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { PurgeProductUseCase } from "../src/application/use-cases/purge-product.js";
import { RestoreProductUseCase } from "../src/application/use-cases/restore-product.js";
import { UpdateProductUseCase } from "../src/application/use-cases/update-product.js";
import { Category } from "../src/domain/entities/category.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import type { Product } from "../src/domain/entities/product.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCategoryRepository } from "../src/infrastructure/database/in-memory-category-repository.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { InMemorySupplierRepository } from "../src/infrastructure/database/in-memory-supplier-repository.js";
import { buildApp } from "../src/interfaces/http/app.js";
import { apiRateLimiter } from "../src/interfaces/http/middlewares/rate-limit.js";
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

const MISSING_PRODUCT_ID = "12345678-1234-4123-8123-123456789012";
const CATEGORY = "22222222-3333-4444-8555-666666666666";
const OTHER_CATEGORY = "44444444-5555-4666-8777-888888888888";
const MISSING_CATEGORY_ID = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";

describe("product endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	beforeEach(() => {
		// The global limiter is a module-level singleton with a 100-request window
		// that counts every request this file sends from the same client, and the
		// limiter is not what any test here asserts (the auth suites own that).
		// Resetting the client's counter keeps the window from leaking between
		// tests; both spellings of the loopback address are cleared because the
		// key is the request's `ip`.
		apiRateLimiter.resetKey("::ffff:127.0.0.1");
		apiRateLimiter.resetKey("127.0.0.1");
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const membershipRepository = new InMemoryMembershipRepository();
		// The ledger and the product reads share one store, exactly like the
		// Prisma adapters share the database: the purge has to see the
		// movements of the very rows this repository serves.
		const store = new Map<string, Product>();
		const productRepository = new InMemoryProductRepository([], store);
		const stockMovementRepository = new InMemoryStockMovementRepository(store);
		const stockLotRepository = new InMemoryStockLotRepository(
			stockMovementRepository,
		);
		const supplierRepository = new InMemorySupplierRepository();
		// The category validation of a product write reads the very store the
		// category endpoints serve, so both share one adapter.
		const categoryRepository = new InMemoryCategoryRepository(
			productRepository,
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

		// The context now carries the company name, so every company a scoped
		// request names has to exist in the store.
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
			products: {
				list: new ListProductsUseCase({
					productRepository,
					stockLotRepository,
					categoryRepository,
				}),
				create: new CreateProductUseCase({
					productRepository,
					categoryRepository,
				}),
				get: new GetProductUseCase({
					productRepository,
					stockLotRepository,
					supplierRepository,
					categoryRepository,
				}),
				units: {} as never,
				update: new UpdateProductUseCase({
					productRepository,
					categoryRepository,
				}),
				remove: new DeleteProductUseCase({ productRepository }),
				restore: new RestoreProductUseCase({
					productRepository,
					categoryRepository,
				}),
				purge: new PurgeProductUseCase({
					productRepository,
					stockMovementRepository,
				}),
			},
			// Not exercised by this suite: the customer slice keeps the app
			// buildable, and its own suite wires it for real.
			customers: {} as never,
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
			suppliers: {} as never,
			categories: {} as never,
			lots: {} as never,
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
			productRepository,
			stockMovementRepository,
			categoryRepository,
			seedMembership,
			seedRoster: () => {
				seedMembership({ userId: owner.id, role: "OWNER" });
				seedMembership({ userId: admin.id, role: "ADMIN" });
				seedMembership({ userId: member.id, role: "MEMBER" });
			},
			seedCategory: (id: string, name: string, companyId = COMPANY) => {
				categoryRepository.save(Category.create({ id, companyId, name }));
			},
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	async function createProduct(
		app: ReturnType<typeof createTestApp>["app"],
		overrides: Record<string, unknown> = {},
	): Promise<Record<string, unknown>> {
		const response = await request(app)
			.post(`/companies/${COMPANY}/products`)
			.set("authorization", authorization(OWNER_SUB))
			.send({
				name: "Cafe molido 500g",
				sku: "CAF-500",
				price: "1500",
				description: "Molido medio",
				...overrides,
			});

		expect(response.status).toBe(201);

		return response.body;
	}

	describe("POST /companies/:companyId/products", () => {
		it("creates a product and answers 201 with the contract shape", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					name: "  Cafe molido 500g  ",
					sku: "caf-500",
					price: "1500",
					description: "Molido medio",
				});

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				id: expect.any(String),
				companyId: COMPANY,
				name: "Cafe molido 500g",
				description: "Molido medio",
				sku: "CAF-500",
				price: "1500.00",
				photoUrl: null,
				stockQuantity: 0,
				lowStockThreshold: 0,
				measureUnit: "KILOGRAM",
				categoryId: null,
				categoryName: null,
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			});
		});

		it("keeps the measure unit the body names", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const body = await createProduct(app, { measureUnit: "LITRE" });

			expect(body.measureUnit).toBe("LITRE");
		});

		it("defaults an absent measure unit to KILOGRAM", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1500" });

			expect(response.status).toBe(201);
			expect(response.body.measureUnit).toBe("KILOGRAM");
		});

		it("lets an ADMIN create", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(ADMIN_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1.5" });

			expect(response.status).toBe(201);
			expect(response.body.price).toBe("1.50");
		});

		it("ignores stock and the low-stock threshold in the body", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const body = await createProduct(app, {
				stockQuantity: 99,
				lowStockThreshold: 5,
			});

			expect(body.stockQuantity).toBe(0);
			expect(body.lowStockThreshold).toBe(0);
		});

		it("creates a product with a category of the company and answers its name", async () => {
			// S7: the category is validated in the same company and the read answers
			// the name, so the client never joins a cached catalogue.
			const { app, seedRoster, seedCategory } = createTestApp();
			seedRoster();
			seedCategory(CATEGORY, "Bebidas");

			const body = await createProduct(app, { categoryId: CATEGORY });

			expect(body.categoryId).toBe(CATEGORY);
			expect(body.categoryName).toBe("Bebidas");
		});

		it("answers 404 category_not_found for a category of another company and writes nothing", async () => {
			const { app, seedRoster, seedCategory } = createTestApp();
			seedRoster();
			seedCategory(OTHER_CATEGORY, "Bebidas", OTHER_COMPANY);

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					name: "Cafe",
					sku: "CAF-500",
					price: "1500",
					categoryId: OTHER_CATEGORY,
				});

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("category_not_found");

			const catalogue = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(catalogue.body).toEqual([]);
		});

		it("answers 404 category_not_found for a category that does not exist", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					name: "Cafe",
					sku: "CAF-500",
					price: "1500",
					categoryId: MISSING_CATEGORY_ID,
				});

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("category_not_found");
		});

		it("answers 403 insufficient_role for a MEMBER", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1500" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 409 sku_already_exists for a duplicate sku of the same company", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createProduct(app);

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Otro cafe", sku: "caf-500", price: "1500" });

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("sku_already_exists");
		});

		it("keeps a soft-deleted product's sku reserved", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1500" });

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("sku_already_exists");
		});

		it.each([
			["a missing name", { name: undefined }],
			["an empty name", { name: "   " }],
			["a negative price", { price: "-1" }],
			["a price with three decimals", { price: "7.505" }],
			["a non-numeric price", { price: "abc" }],
			["an empty sku", { sku: "  " }],
			["a photo url that is not http", { photoUrl: "ftp://example.com/a.png" }],
			["a measure unit outside the closed list", { measureUnit: "POUND" }],
			["a lowercased measure unit", { measureUnit: "kilogram" }],
			["a category id that is not a uuid", { categoryId: "bebidas" }],
		])("answers 400 with issues for %s", async (_label, overrides) => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					name: "Cafe",
					sku: "CAF-500",
					price: "1500",
					...overrides,
				});

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});

		it("answers 401 without a token and 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const withoutToken = await request(app).post(
				`/companies/${COMPANY}/products`,
			);
			const outsider = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OUTSIDER_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1500" });

			expect(withoutToken.status).toBe(401);
			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("GET /companies/:companyId/products", () => {
		it("lists the company's products ordered by name and then id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createProduct(app, { name: "Zapallo", sku: "ZAP-1" });
			await createProduct(app, { name: "Cafe", sku: "CAF-1" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map((product: { name: string }) => product.name),
			).toEqual(["Cafe", "Zapallo"]);
		});

		it("returns the measure unit of every product", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createProduct(app, {
				name: "Pintura",
				sku: "PIN-1",
				measureUnit: "LITRE",
			});
			await createProduct(app, { name: "Cafe", sku: "CAF-1" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map(
					(product: { name: string; measureUnit: string }) =>
						`${product.name}:${product.measureUnit}`,
				),
			).toEqual(["Cafe:KILOGRAM", "Pintura:LITRE"]);
		});

		it("names the category of every product and leaves it null without one", async () => {
			// S5: the list resolves the name in one batch, so the dashboard shows
			// the category without crossing a cached catalogue.
			const { app, seedRoster, seedCategory } = createTestApp();
			seedRoster();
			seedCategory(CATEGORY, "Bebidas");
			await createProduct(app, {
				name: "Cafe",
				sku: "CAF-1",
				categoryId: CATEGORY,
			});
			await createProduct(app, { name: "Azucar", sku: "SUGAR-1" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map(
					(product: { name: string; categoryName: string | null }) => [
						product.name,
						product.categoryName,
					],
				),
			).toEqual([
				["Azucar", null],
				["Cafe", "Bebidas"],
			]);
		});

		it("searches by name or sku, case-insensitively", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createProduct(app, { name: "Cafe molido", sku: "CAF-500" });
			await createProduct(app, { name: "Azucar", sku: "SUGAR-1" });

			const byName = await request(app)
				.get(`/companies/${COMPANY}/products?search=CAFE`)
				.set("authorization", authorization(OWNER_SUB));
			const bySku = await request(app)
				.get(`/companies/${COMPANY}/products?search=sug`)
				.set("authorization", authorization(OWNER_SUB));

			expect(
				byName.body.map((product: { sku: string }) => product.sku),
			).toEqual(["CAF-500"]);
			expect(bySku.body.map((product: { sku: string }) => product.sku)).toEqual(
				["SUGAR-1"],
			);
		});

		it("never lists another company's products", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			// The same OWNER also belongs to the other company, so both products
			// are reachable by this caller and only the company filter separates
			// them.
			seedMembership({ userId: owner.id, role: "OWNER" });
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			await createProduct(app);
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno", sku: "AJE-1", price: "10" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB));

			expect(foreign.status).toBe(201);
			expect(
				response.body.map((product: { sku: string }) => product.sku),
			).toEqual(["CAF-500"]);
		});

		it("answers 400 when the search is longer than 100 characters", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/products?search=${"a".repeat(101)}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});

		it("answers 400 for a malformed company id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get("/companies/not-a-uuid/products")
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
		});

		it("lists only the soft-deleted products with ?deleted=true", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const deleted = await createProduct(app, {
				name: "Cafe",
				sku: "CAF-1",
			});
			await createProduct(app, { name: "Zapallo", sku: "ZAP-1" });

			await request(app)
				.delete(`/companies/${COMPANY}/products/${deleted.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const trash = await request(app)
				.get(`/companies/${COMPANY}/products?deleted=true`)
				.set("authorization", authorization(MEMBER_SUB));
			const catalogue = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));
			const explicitActive = await request(app)
				.get(`/companies/${COMPANY}/products?deleted=false`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(trash.status).toBe(200);
			expect(trash.body).toEqual([
				expect.objectContaining({ id: deleted.id, sku: "CAF-1" }),
			]);
			expect(
				catalogue.body.map((product: { sku: string }) => product.sku),
			).toEqual(["ZAP-1"]);
			expect(explicitActive.body).toEqual(catalogue.body);
		});

		it("keeps the search and the order inside the trash", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const first = await createProduct(app, {
				name: "Cafe molido",
				sku: "CAF-500",
			});
			const second = await createProduct(app, {
				name: "Cafe en grano",
				sku: "CAF-900",
			});
			await createProduct(app, { name: "Cafe activo", sku: "CAF-100" });

			for (const product of [first, second]) {
				await request(app)
					.delete(`/companies/${COMPANY}/products/${product.id}`)
					.set("authorization", authorization(OWNER_SUB));
			}

			const response = await request(app)
				.get(`/companies/${COMPANY}/products?deleted=true&search=cafe`)
				.set("authorization", authorization(OWNER_SUB));

			expect(
				response.body.map((product: { name: string }) => product.name),
			).toEqual(["Cafe en grano", "Cafe molido"]);
		});

		it("answers 400 for a deleted value that is not true or false", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/products?deleted=maybe`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});
	});

	describe("GET /companies/:companyId/products/:productId", () => {
		it("reads one product for any member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.get(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				...product,
				availableUnits: 0,
				availableMeasure: "0.000",
				costPerMeasure: null,
				unitCost: null,
				marginPerUnit: null,
				lots: [],
			});
		});

		it("returns the measure unit of the product", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app, { measureUnit: "METRE" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body.measureUnit).toBe("METRE");
		});

		it("returns the category name of the product", async () => {
			const { app, seedRoster, seedCategory } = createTestApp();
			seedRoster();
			seedCategory(CATEGORY, "Bebidas");
			const product = await createProduct(app, { categoryId: CATEGORY });

			const response = await request(app)
				.get(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body.categoryId).toBe(CATEGORY);
			expect(response.body.categoryName).toBe("Bebidas");
		});

		it("answers 404 product_not_found for another company's product", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno", sku: "AJE-1", price: "10" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/products/${foreign.body.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(foreign.status).toBe(201);
			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
		});

		it("answers 404 product_not_found for a product that does not exist", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/products/${MISSING_PRODUCT_ID}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
		});

		it("answers 400 for a malformed product id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/products/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
		});
	});

	describe("PATCH /companies/:companyId/products/:productId", () => {
		it("updates the given fields and keeps the untouched ones", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app, {
				photoUrl: "https://example.com/a.png",
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(ADMIN_SUB))
				.send({ name: "Cafe en grano", price: "7.5" });

			expect(response.status).toBe(200);
			expect(response.body).toMatchObject({
				id: product.id,
				name: "Cafe en grano",
				price: "7.50",
				sku: "CAF-500",
				description: "Molido medio",
				photoUrl: "https://example.com/a.png",
				stockQuantity: 0,
			});
		});

		it("changes the measure unit", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ measureUnit: "LITRE" });

			expect(response.status).toBe(200);
			expect(response.body.measureUnit).toBe("LITRE");
		});

		it("leaves the measure unit untouched when the body does not name it", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app, { measureUnit: "METRE" });

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe en grano" });

			expect(response.status).toBe(200);
			expect(response.body.measureUnit).toBe("METRE");
		});

		it("answers 400 for a measure unit outside the closed list", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ measureUnit: "POUND" });

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});

		it("clears description and photoUrl with an explicit null", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app, {
				photoUrl: "https://example.com/a.png",
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ description: null, photoUrl: null });

			expect(response.status).toBe(200);
			expect(response.body.description).toBeNull();
			expect(response.body.photoUrl).toBeNull();
		});

		it("sets the category and clears it with an explicit null", async () => {
			// S7: absent means "unchanged", an explicit `null` clears it.
			const { app, seedRoster, seedCategory } = createTestApp();
			seedRoster();
			seedCategory(CATEGORY, "Bebidas");
			const product = await createProduct(app);

			const set = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ categoryId: CATEGORY });

			expect(set.status).toBe(200);
			expect(set.body.categoryId).toBe(CATEGORY);
			expect(set.body.categoryName).toBe("Bebidas");

			const cleared = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ categoryId: null });

			expect(cleared.status).toBe(200);
			expect(cleared.body.categoryId).toBeNull();
			expect(cleared.body.categoryName).toBeNull();
		});

		it("leaves the category untouched when the body does not name it", async () => {
			const { app, seedRoster, seedCategory } = createTestApp();
			seedRoster();
			seedCategory(CATEGORY, "Bebidas");
			const product = await createProduct(app, { categoryId: CATEGORY });

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe en grano" });

			expect(response.status).toBe(200);
			expect(response.body.categoryId).toBe(CATEGORY);
			expect(response.body.categoryName).toBe("Bebidas");
		});

		it("answers 404 category_not_found for a foreign or unknown category and touches nothing", async () => {
			const { app, seedRoster, seedCategory } = createTestApp();
			seedRoster();
			seedCategory(OTHER_CATEGORY, "Bebidas", OTHER_COMPANY);
			const product = await createProduct(app);

			const foreign = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ categoryId: OTHER_CATEGORY });
			const missing = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ categoryId: MISSING_CATEGORY_ID });

			expect(foreign.status).toBe(404);
			expect(foreign.body.error.code).toBe("category_not_found");
			expect(missing.status).toBe(404);
			expect(missing.body.error.code).toBe("category_not_found");

			const read = await request(app)
				.get(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(read.body.categoryId).toBeNull();
		});

		it("never moves the stock, even if the body tries to", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ stockQuantity: 99 });

			expect(response.status).toBe(200);
			expect(response.body.stockQuantity).toBe(0);
		});

		it("answers 409 sku_already_exists when another product owns the sku", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const first = await createProduct(app, { name: "Cafe", sku: "CAF-500" });
			const second = await createProduct(app, {
				name: "Azucar",
				sku: "SUGAR-1",
			});

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${second.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ sku: "caf-500" });

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("sku_already_exists");
			expect(first.sku).toBe("CAF-500");
		});

		it("lets a product keep its own sku", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ sku: "caf-500", name: "Cafe en grano" });

			expect(response.status).toBe(200);
			expect(response.body.sku).toBe("CAF-500");
		});

		it("answers 403 insufficient_role for a MEMBER", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ name: "Cafe en grano" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 404 product_not_found for a soft-deleted product", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe en grano" });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
		});

		it("answers 400 for an invalid body and for a malformed product id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const badBody = await request(app)
				.patch(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ price: "7.505" });
			const badId = await request(app)
				.patch(`/companies/${COMPANY}/products/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe en grano" });

			expect(badBody.status).toBe(400);
			expect(badId.status).toBe(400);
		});
	});

	describe("DELETE /companies/:companyId/products/:productId", () => {
		it("soft-deletes and answers 204, then the product is gone from every read", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const deleted = await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(ADMIN_SUB));
			const read = await request(app)
				.get(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));
			const list = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB));

			expect(deleted.status).toBe(204);
			expect(deleted.text).toBe("");
			expect(read.status).toBe(404);
			expect(list.body).toEqual([]);
		});

		it("answers 404 product_not_found on a second delete", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));
			const second = await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(second.status).toBe(404);
			expect(second.body.error.code).toBe("product_not_found");
		});

		it("answers 403 insufficient_role for a MEMBER", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 400 for a malformed product id and 404 for an absent one", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const badId = await request(app)
				.delete(`/companies/${COMPANY}/products/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB));
			const absent = await request(app)
				.delete(`/companies/${COMPANY}/products/${MISSING_PRODUCT_ID}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(badId.status).toBe(400);
			expect(absent.status).toBe(404);
		});
	});

	describe("POST /companies/:companyId/products/:productId/restore", () => {
		it("restores a deleted product and answers 200 with it active again", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const restored = await request(app)
				.post(`/companies/${COMPANY}/products/${product.id}/restore`)
				.set("authorization", authorization(ADMIN_SUB));

			expect(restored.status).toBe(200);
			// The restore answers the same product write contract as the create and
			// the update, so the resolved category name travels with it too.
			expect(restored.body).toEqual({
				...product,
				updatedAt: expect.any(String),
			});
		});

		it("brings the product back to the catalogue and out of the trash", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));
			await request(app)
				.post(`/companies/${COMPANY}/products/${product.id}/restore`)
				.set("authorization", authorization(OWNER_SUB));

			const catalogue = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));
			const trash = await request(app)
				.get(`/companies/${COMPANY}/products?deleted=true`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(catalogue.body.map((row: { id: string }) => row.id)).toEqual([
				product.id,
			]);
			expect(trash.body).toEqual([]);
		});

		it("keeps the sku reserved after the delete and reuses the row instead of a new create", async () => {
			// S2: the SKU never chokes on restore because the unique index kept
			// it reserved while the product was in the trash.
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const duplicate = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1500" });

			const restored = await request(app)
				.post(`/companies/${COMPANY}/products/${product.id}/restore`)
				.set("authorization", authorization(OWNER_SUB));

			const stillReserved = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1500" });

			expect(duplicate.status).toBe(409);
			expect(duplicate.body.error.code).toBe("sku_already_exists");
			expect(restored.status).toBe(200);
			expect(restored.body).toMatchObject({
				id: product.id,
				sku: "CAF-500",
			});
			expect(stillReserved.status).toBe(409);
			expect(stillReserved.body.error.code).toBe("sku_already_exists");
		});

		it("answers 409 product_not_deleted for a product that is not deleted", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.post(`/companies/${COMPANY}/products/${product.id}/restore`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("product_not_deleted");
		});

		it("answers 409 on a second restore", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));
			await request(app)
				.post(`/companies/${COMPANY}/products/${product.id}/restore`)
				.set("authorization", authorization(OWNER_SUB));
			const second = await request(app)
				.post(`/companies/${COMPANY}/products/${product.id}/restore`)
				.set("authorization", authorization(OWNER_SUB));

			expect(second.status).toBe(409);
			expect(second.body.error.code).toBe("product_not_deleted");
		});

		it("answers 404 product_not_found for another company's product", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno", sku: "AJE-1", price: "10" });

			await request(app)
				.delete(`/companies/${OTHER_COMPANY}/products/${foreign.body.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.post(`/companies/${COMPANY}/products/${foreign.body.id}/restore`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
		});

		it("answers 404 product_not_found for a product that does not exist", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/products/${MISSING_PRODUCT_ID}/restore`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
		});

		it("answers 403 insufficient_role for a MEMBER", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.post(`/companies/${COMPANY}/products/${product.id}/restore`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 400 for a malformed product id and 401 without a token", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const badId = await request(app)
				.post(`/companies/${COMPANY}/products/not-a-uuid/restore`)
				.set("authorization", authorization(OWNER_SUB));
			const withoutToken = await request(app).post(
				`/companies/${COMPANY}/products/${MISSING_PRODUCT_ID}/restore`,
			);

			expect(badId.status).toBe(400);
			expect(withoutToken.status).toBe(401);
		});
	});
	describe("DELETE /companies/:companyId/products/:productId/permanent", () => {
		it("purges a deleted product and answers 204, and it is gone from both lists", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const purged = await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}/permanent`)
				.set("authorization", authorization(OWNER_SUB));
			const trash = await request(app)
				.get(`/companies/${COMPANY}/products?deleted=true`)
				.set("authorization", authorization(MEMBER_SUB));
			const catalogue = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(purged.status).toBe(204);
			expect(purged.text).toBe("");
			expect(trash.body).toEqual([]);
			expect(catalogue.body).toEqual([]);
		});

		it("frees the sku, so the same sku may be created again", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));
			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}/permanent`)
				.set("authorization", authorization(OWNER_SUB));

			const recreated = await request(app)
				.post(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Cafe", sku: "CAF-500", price: "1500" });

			expect(recreated.status).toBe(201);
			expect(recreated.body.sku).toBe("CAF-500");
		});

		it.each([
			["ADMIN", ADMIN_SUB],
			["MEMBER", MEMBER_SUB],
		])("answers 403 insufficient_role for a %s", async (_role, sub) => {
			// S3/L2: only the OWNER purges; the ADMIN may manage the catalogue
			// but never destroy a row.
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}/permanent`)
				.set("authorization", authorization(sub));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
		});

		it("answers 404 product_not_found for another company's product", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/products`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajeno", sku: "AJE-1", price: "10" });

			await request(app)
				.delete(`/companies/${OTHER_COMPANY}/products/${foreign.body.id}`)
				.set("authorization", authorization(OWNER_SUB));

			const response = await request(app)
				.delete(`/companies/${COMPANY}/products/${foreign.body.id}/permanent`)
				.set("authorization", authorization(OWNER_SUB));
			const foreignTrash = await request(app)
				.get(`/companies/${OTHER_COMPANY}/products?deleted=true`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
			// The foreign row is untouched: the company is part of the DELETE.
			expect(foreignTrash.body.map((row: { id: string }) => row.id)).toEqual([
				foreign.body.id,
			]);
		});

		it("answers 409 product_not_deleted for an active product", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const product = await createProduct(app);

			const response = await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}/permanent`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("product_not_deleted");
		});

		it("answers 409 product_has_movements with the count, and nothing is deleted", async () => {
			const { app, seedRoster, stockMovementRepository, owner } =
				createTestApp();
			seedRoster();
			const product = await createProduct(app);

			await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}`)
				.set("authorization", authorization(OWNER_SUB));
			stockMovementRepository.save(
				StockMovement.create({
					companyId: COMPANY,
					productId: product.id as string,
					userId: owner.id,
					type: "IN",
					quantity: 3,
				}),
			);

			const response = await request(app)
				.delete(`/companies/${COMPANY}/products/${product.id}/permanent`)
				.set("authorization", authorization(OWNER_SUB));
			const trash = await request(app)
				.get(`/companies/${COMPANY}/products?deleted=true`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("product_has_movements");
			expect(response.body.error.message).toContain("1");
			// The ledger is the audit trail (MOV-05) and the row is still there.
			expect(
				await stockMovementRepository.countByProduct(
					COMPANY,
					product.id as string,
				),
			).toBe(1);
			expect(trash.body.map((row: { id: string }) => row.id)).toEqual([
				product.id,
			]);
		});

		it("answers 400 for a malformed product id and 401 without a token", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const badId = await request(app)
				.delete(`/companies/${COMPANY}/products/not-a-uuid/permanent`)
				.set("authorization", authorization(OWNER_SUB));
			const withoutToken = await request(app).delete(
				`/companies/${COMPANY}/products/${MISSING_PRODUCT_ID}/permanent`,
			);

			expect(badId.status).toBe(400);
			expect(badId.body.error.message).toBe("Invalid product id");
			expect(withoutToken.status).toBe(401);
		});
	});
});
