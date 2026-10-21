import request from "supertest";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { ListStockMovementsUseCase } from "../src/application/use-cases/list-stock-movements.js";
import { RegisterStockMovementUseCase } from "../src/application/use-cases/register-stock-movement.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
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
const MISSING_PRODUCT_ID = "12345678-1234-4123-8123-123456789012";

const OWNER_SUB = "auth0|owner";
const ADMIN_SUB = "auth0|admin";
const MEMBER_SUB = "auth0|member";
const OUTSIDER_SUB = "auth0|outsider";

describe("stock movement endpoints", () => {
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
		// The ledger and the product reads share one store, which is the
		// adapter-specific contract of the in-memory adapters.
		const store = new Map<string, Product>();
		const productRepository = new InMemoryProductRepository([], store);
		const stockMovementRepository = new InMemoryStockMovementRepository(store);

		const owner = User.create({
			auth0Sub: OWNER_SUB,
			email: "owner@x.com",
			fullName: "Olivia Owner",
		});
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
			updateUserFullName: {} as never,
			products: {
				// The read of the catalogue is wired for real: the stock a
				// movement produced has to be visible there (MOV-04).
				list: new ListProductsUseCase({ productRepository }),
				create: {} as never,
				get: {} as never,
				update: {} as never,
				remove: {} as never,
			},
			movements: {
				register: new RegisterStockMovementUseCase({
					productRepository,
					stockMovementRepository,
				}),
				list: new ListStockMovementsUseCase({
					stockMovementRepository,
					productRepository,
					userRepository,
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
			owner,
			admin,
			member,
			outsider,
			productRepository,
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

	/**
	 * Seeds a product directly through the product repository: the movements
	 * slice must not depend on the products endpoints, and the stock of the
	 * fixture has to start from a known value.
	 */
	async function seedProduct(
		app_products: InMemoryProductRepository,
		overrides: {
			id?: string;
			companyId?: string;
			name?: string;
			sku?: string;
			stockQuantity?: number;
			deleted?: boolean;
		} = {},
	) {
		const product = Product.create({
			id: overrides.id ?? "aaaaaaaa-1111-4111-8111-111111111111",
			companyId: overrides.companyId ?? COMPANY,
			name: overrides.name ?? "Cafe molido 500g",
			sku: overrides.sku ?? "CAF-500",
			price: "1500",
			stockQuantity: overrides.stockQuantity ?? 0,
			deletedAt: overrides.deleted
				? new Date("2026-10-22T12:00:00.000Z")
				: null,
		});

		await app_products.create(product);

		return product;
	}

	describe("POST /companies/:companyId/movements", () => {
		it("registers an IN and answers 201 with the movement and the resulting stock", async () => {
			const { app, seedRoster, productRepository, owner } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository);

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					productId: product.id,
					type: "IN",
					quantity: 10,
					reason: "  Compra a proveedor  ",
				});

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				id: expect.any(String),
				companyId: COMPANY,
				productId: product.id,
				type: "IN",
				quantity: 10,
				reason: "Compra a proveedor",
				createdAt: expect.any(String),
				product: { id: product.id, name: "Cafe molido 500g", sku: "CAF-500" },
				actor: { id: owner.id, fullName: "Olivia Owner", email: "owner@x.com" },
				stockQuantity: 10,
			});
		});

		it("registers an OUT and reflects the new stock in GET /products", async () => {
			const { app, seedRoster, productRepository } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository, {
				stockQuantity: 10,
			});

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ productId: product.id, type: "OUT", quantity: 4 });
			const catalogue = await request(app)
				.get(`/companies/${COMPANY}/products`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(201);
			expect(response.body.stockQuantity).toBe(6);
			expect(response.body.reason).toBeNull();
			// The product read shows the stock the movement produced, without a
			// second write to the product.
			expect(catalogue.status).toBe(200);
			expect(catalogue.body[0].stockQuantity).toBe(6);
		});

		it.each([
			["OWNER", OWNER_SUB],
			["ADMIN", ADMIN_SUB],
			["MEMBER", MEMBER_SUB],
		])("lets a %s register a movement", async (_role, sub) => {
			const { app, seedRoster, productRepository } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository);

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(sub))
				.send({ productId: product.id, type: "IN", quantity: 1 });

			expect(response.status).toBe(201);
		});

		it("answers 409 insufficient_stock and leaves the stock and the history untouched", async () => {
			const { app, seedRoster, productRepository } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository, {
				stockQuantity: 10,
			});

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ productId: product.id, type: "OUT", quantity: 11 });
			const history = await request(app)
				.get(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("insufficient_stock");
			expect(response.body.error.message).toContain("10");
			expect(history.body).toEqual([]);
			await expect(
				productRepository.findActiveById(COMPANY, product.id),
			).resolves.toMatchObject({ stockQuantity: 10 });
		});

		it("answers 404 product_not_found for another company's product and records nothing", async () => {
			const { app, seedRoster, seedMembership, productRepository, owner } =
				createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await seedProduct(productRepository, {
				companyId: OTHER_COMPANY,
				sku: "AJE-1",
				stockQuantity: 10,
			});

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ productId: foreign.id, type: "IN", quantity: 1 });
			const history = await request(app)
				.get(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
			expect(history.body).toEqual([]);
		});

		it("answers 404 product_not_found for a soft-deleted product", async () => {
			const { app, seedRoster, productRepository } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository, {
				deleted: true,
			});

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ productId: product.id, type: "IN", quantity: 1 });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
		});

		it("answers 404 product_not_found for an absent product", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ productId: MISSING_PRODUCT_ID, type: "IN", quantity: 1 });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("product_not_found");
		});

		it.each([
			["quantity 0", { quantity: 0 }],
			["a fractional quantity", { quantity: 1.5 }],
			["a quantity above the maximum", { quantity: 1_000_001 }],
			["a missing quantity", { quantity: undefined }],
			["a bad type", { type: "ADJUST" }],
			["a missing type", { type: undefined }],
			["a malformed productId", { productId: "not-a-uuid" }],
			["a reason longer than 300 characters", { reason: "a".repeat(301) }],
		])("answers 400 for %s", async (_label, overrides) => {
			const { app, seedRoster, productRepository } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository);

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					productId: product.id,
					type: "IN",
					quantity: 1,
					...overrides,
				});

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});

		it("answers 401 without a token and 403 for a non-member", async () => {
			const { app, seedRoster, productRepository } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository);

			const withoutToken = await request(app).post(
				`/companies/${COMPANY}/movements`,
			);
			const outsider = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OUTSIDER_SUB))
				.send({ productId: product.id, type: "IN", quantity: 1 });

			expect(withoutToken.status).toBe(401);
			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("GET /companies/:companyId/movements", () => {
		async function seedHistory(app_: ReturnType<typeof buildApp>) {
			// The movements are registered through the API so the history is the
			// real one, not a hand-built list.
			const first = await request(app_)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ productId: PRODUCT_A, type: "IN", quantity: 10 });
			await new Promise((resolve) => setTimeout(resolve, 5));
			const second = await request(app_)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ productId: PRODUCT_A, type: "OUT", quantity: 3 });
			await new Promise((resolve) => setTimeout(resolve, 5));
			const third = await request(app_)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(ADMIN_SUB))
				.send({ productId: PRODUCT_B, type: "IN", quantity: 7 });

			return [first, second, third];
		}

		const PRODUCT_A = "aaaaaaaa-1111-4111-8111-111111111111";
		const PRODUCT_B = "bbbbbbbb-2222-4222-8222-222222222222";

		async function appWithHistory() {
			const testApp = createTestApp();
			testApp.seedRoster();
			await seedProduct(testApp.productRepository, {
				id: PRODUCT_A,
				sku: "CAF-500",
			});
			await seedProduct(testApp.productRepository, {
				id: PRODUCT_B,
				name: "Azucar",
				sku: "SUGAR-1",
			});
			const created = await seedHistory(testApp.app);

			return { ...testApp, created };
		}

		it("lists the company's movements newest first with product and actor resolved", async () => {
			const { app, member } = await appWithHistory();

			const response = await request(app)
				.get(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toHaveLength(3);
			expect(
				response.body.map(
					(movement: { productId: string }) => movement.productId,
				),
			).toEqual([PRODUCT_B, PRODUCT_A, PRODUCT_A]);
			expect(response.body[0]).toEqual({
				id: expect.any(String),
				companyId: COMPANY,
				productId: PRODUCT_B,
				type: "IN",
				quantity: 7,
				reason: null,
				createdAt: expect.any(String),
				product: { id: PRODUCT_B, name: "Azucar", sku: "SUGAR-1" },
				actor: { id: expect.any(String), fullName: null, email: "admin@x.com" },
			});
			expect(response.body[1].actor.id).toBe(member.id);
		});

		it("filters by productId and by type", async () => {
			const { app } = await appWithHistory();

			const byProduct = await request(app)
				.get(`/companies/${COMPANY}/movements?productId=${PRODUCT_B}`)
				.set("authorization", authorization(OWNER_SUB));
			const byType = await request(app)
				.get(`/companies/${COMPANY}/movements?type=OUT`)
				.set("authorization", authorization(OWNER_SUB));

			expect(
				byProduct.body.map(
					(movement: { productId: string }) => movement.productId,
				),
			).toEqual([PRODUCT_B]);
			expect(
				byType.body.map((movement: { type: string }) => movement.type),
			).toEqual(["OUT"]);
		});

		it("applies the limit, keeping the newest movements", async () => {
			const { app } = await appWithHistory();

			const response = await request(app)
				.get(`/companies/${COMPANY}/movements?limit=2`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map(
					(movement: { productId: string }) => movement.productId,
				),
			).toEqual([PRODUCT_B, PRODUCT_A]);
		});

		it.each([
			["a limit of 0", "limit=0"],
			["a limit above 200", "limit=201"],
			["a non-integer limit", "limit=1.5"],
			["a non-numeric limit", "limit=abc"],
			["a malformed productId", "productId=not-a-uuid"],
			["a bad type", "type=ADJUST"],
		])("answers 400 for %s", async (_label, query) => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/movements?${query}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
		});

		it("answers 403 for a non-member and 400 for a malformed company id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const outsider = await request(app)
				.get(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OUTSIDER_SUB));
			const badCompany = await request(app)
				.get("/companies/not-a-uuid/movements")
				.set("authorization", authorization(OWNER_SUB));

			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
			expect(badCompany.status).toBe(400);
		});
	});
});
