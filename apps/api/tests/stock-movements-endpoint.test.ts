import request from "supertest";
import { GetMovementTrendUseCase } from "../src/application/use-cases/get-movement-trend.js";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { ListStockMovementsUseCase } from "../src/application/use-cases/list-stock-movements.js";
import { RegisterStockMovementUseCase } from "../src/application/use-cases/register-stock-movement.js";
import { Company } from "../src/domain/entities/company.js";
import { Customer } from "../src/domain/entities/customer.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryCustomerRepository } from "../src/infrastructure/database/in-memory-customer-repository.js";
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
const CUSTOMER_ID = "cccccccc-3333-4333-8333-333333333333";
const SECOND_CUSTOMER_ID = "ffffffff-6666-4666-8666-666666666666";
const OTHER_CUSTOMER_ID = "dddddddd-4444-4444-8444-444444444444";
const MISSING_CUSTOMER_ID = "eeeeeeee-5555-4555-8555-555555555555";

const OWNER_SUB = "auth0|owner";
const ADMIN_SUB = "auth0|admin";
const MEMBER_SUB = "auth0|member";
const OUTSIDER_SUB = "auth0|outsider";

/**
 * The trend report is defined per UTC day, so its clock is fixed: a suite that
 * read the machine's clock would change its expected dates every UTC midnight.
 */
const TREND_NOW = new Date("2026-10-21T12:00:00.000Z");

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
		const customerRepository = new InMemoryCustomerRepository();

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
			// Not exercised by this suite: the customer slice keeps the app
			// buildable, and its own suite wires it for real.
			customers: {} as never,
			movements: {
				register: new RegisterStockMovementUseCase({
					productRepository,
					stockMovementRepository,
					customerRepository,
				}),
				list: new ListStockMovementsUseCase({
					stockMovementRepository,
					productRepository,
					userRepository,
					customerRepository,
				}),
				trend: new GetMovementTrendUseCase({
					stockMovementRepository,
					now: () => TREND_NOW,
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
			customerRepository,
			stockMovementRepository,
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

	/**
	 * Seeds a customer directly through the customer repository: the movements
	 * slice must not depend on the customers endpoints, and the roster of the
	 * fixture has to start from a known state.
	 */
	async function seedCustomer(
		app_customers: InMemoryCustomerRepository,
		overrides: {
			id?: string;
			companyId?: string;
			name?: string;
			deleted?: boolean;
		} = {},
	) {
		const customer = Customer.create({
			id: overrides.id ?? CUSTOMER_ID,
			companyId: overrides.companyId ?? COMPANY,
			name: overrides.name ?? "Maria Gonzalez",
			deletedAt: overrides.deleted
				? new Date("2026-10-22T12:00:00.000Z")
				: null,
		});

		await app_customers.create(customer);

		return customer;
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
				customerId: null,
				customer: null,
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
			// An exit without a customer is a valid anonymous sale.
			expect(response.body.customerId).toBeNull();
			expect(response.body.customer).toBeNull();
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

		it("associates a customer with an OUT and answers 201 with it resolved", async () => {
			const { app, seedRoster, productRepository, customerRepository } =
				createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository, {
				stockQuantity: 10,
			});
			const customer = await seedCustomer(customerRepository);

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					productId: product.id,
					type: "OUT",
					quantity: 3,
					customerId: customer.id,
				});

			expect(response.status).toBe(201);
			expect(response.body.customerId).toBe(customer.id);
			expect(response.body.customer).toEqual({
				id: customer.id,
				name: "Maria Gonzalez",
			});
			expect(response.body.stockQuantity).toBe(7);
		});

		it("answers 400 customer_requires_exit for an IN with a customer and records nothing", async () => {
			const { app, seedRoster, productRepository, customerRepository } =
				createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository, {
				stockQuantity: 10,
			});
			const customer = await seedCustomer(customerRepository);

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					productId: product.id,
					type: "IN",
					quantity: 1,
					customerId: customer.id,
				});
			const history = await request(app)
				.get(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
			expect(response.body.error.code).toBe("customer_requires_exit");
			expect(history.body).toEqual([]);
			await expect(
				productRepository.findActiveById(COMPANY, product.id),
			).resolves.toMatchObject({ stockQuantity: 10 });
		});

		const customerCases: Array<
			[
				string,
				{ id?: string; companyId?: string; deleted?: boolean } | null,
				string,
			]
		> = [
			["an absent customer", null, MISSING_CUSTOMER_ID],
			[
				"another company's customer",
				{ id: OTHER_CUSTOMER_ID, companyId: OTHER_COMPANY },
				OTHER_CUSTOMER_ID,
			],
			["a soft-deleted customer", { deleted: true }, CUSTOMER_ID],
		];

		it.each(customerCases)(
			"answers 404 customer_not_found for %s and leaves the stock and the history untouched",
			async (_label, seed, customerId) => {
				const { app, seedRoster, productRepository, customerRepository } =
					createTestApp();
				seedRoster();
				if (seed !== null) {
					await seedCustomer(customerRepository, seed);
				}
				const product = await seedProduct(productRepository, {
					stockQuantity: 10,
				});

				const response = await request(app)
					.post(`/companies/${COMPANY}/movements`)
					.set("authorization", authorization(OWNER_SUB))
					.send({
						productId: product.id,
						type: "OUT",
						quantity: 2,
						customerId,
					});
				const history = await request(app)
					.get(`/companies/${COMPANY}/movements`)
					.set("authorization", authorization(OWNER_SUB));

				expect(response.status).toBe(404);
				expect(response.body.error.code).toBe("customer_not_found");
				expect(history.body).toEqual([]);
				await expect(
					productRepository.findActiveById(COMPANY, product.id),
				).resolves.toMatchObject({ stockQuantity: 10 });
			},
		);

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

		it("answers 400 for a malformed customerId on an exit", async () => {
			const { app, seedRoster, productRepository } = createTestApp();
			seedRoster();
			const product = await seedProduct(productRepository, {
				stockQuantity: 10,
			});

			const response = await request(app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					productId: product.id,
					type: "OUT",
					quantity: 1,
					customerId: "not-a-uuid",
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
		const PRODUCT_FOREIGN = "ffffffff-7777-4777-8777-777777777777";

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

		/**
		 * Seeds two sales of one customer on different products, one sale of
		 * another customer, an anonymous entry and one sale under the other
		 * company, all through the API so the history is the real one.
		 */
		async function appWithSales() {
			const testApp = createTestApp();
			testApp.seedRoster();
			// The owner belongs to both companies, so the other company's sale can
			// be read there and the filter's isolation is observable.
			testApp.seedMembership({
				userId: testApp.owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			await seedProduct(testApp.productRepository, {
				id: PRODUCT_A,
				sku: "CAF-500",
				stockQuantity: 100,
			});
			await seedProduct(testApp.productRepository, {
				id: PRODUCT_B,
				name: "Azucar",
				sku: "SUGAR-1",
				stockQuantity: 100,
			});
			await seedProduct(testApp.productRepository, {
				id: PRODUCT_FOREIGN,
				companyId: OTHER_COMPANY,
				name: "Aji",
				sku: "AJE-1",
				stockQuantity: 100,
			});
			await seedCustomer(testApp.customerRepository);
			await seedCustomer(testApp.customerRepository, {
				id: SECOND_CUSTOMER_ID,
				name: "Juan Perez",
			});
			await seedCustomer(testApp.customerRepository, {
				id: OTHER_CUSTOMER_ID,
				companyId: OTHER_COMPANY,
				name: "Globex Buyer",
			});

			async function post(companyId: string, body: Record<string, unknown>) {
				const response = await request(testApp.app)
					.post(`/companies/${companyId}/movements`)
					.set("authorization", authorization(OWNER_SUB))
					.send(body);

				expect(response.status).toBe(201);
				// A small gap between the posts keeps the newest-first order
				// deterministic, like `seedHistory` does.
				await new Promise((resolve) => setTimeout(resolve, 5));

				return response.body as { id: string };
			}

			const saleA = await post(COMPANY, {
				productId: PRODUCT_A,
				type: "OUT",
				quantity: 2,
				customerId: CUSTOMER_ID,
			});
			const saleB = await post(COMPANY, {
				productId: PRODUCT_B,
				type: "OUT",
				quantity: 1,
				customerId: CUSTOMER_ID,
			});
			const saleC = await post(COMPANY, {
				productId: PRODUCT_A,
				type: "OUT",
				quantity: 3,
				customerId: SECOND_CUSTOMER_ID,
			});
			const entry = await post(COMPANY, {
				productId: PRODUCT_A,
				type: "IN",
				quantity: 10,
			});
			await post(OTHER_COMPANY, {
				productId: PRODUCT_FOREIGN,
				type: "OUT",
				quantity: 1,
				customerId: OTHER_CUSTOMER_ID,
			});

			return { ...testApp, sales: { saleA, saleB, saleC, entry } };
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
				customerId: null,
				customer: null,
				product: { id: PRODUCT_B, name: "Azucar", sku: "SUGAR-1" },
				actor: { id: expect.any(String), fullName: null, email: "admin@x.com" },
			});
			expect(response.body[1].actor.id).toBe(member.id);
		});

		it("returns the customer of a sale and keeps it readable after the soft delete", async () => {
			const testApp = createTestApp();
			testApp.seedRoster();
			await seedProduct(testApp.productRepository, {
				id: PRODUCT_A,
				sku: "CAF-500",
				stockQuantity: 10,
			});
			const customer = await seedCustomer(testApp.customerRepository);

			const created = await request(testApp.app)
				.post(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					productId: PRODUCT_A,
					type: "OUT",
					quantity: 2,
					customerId: customer.id,
				});
			await testApp.customerRepository.softDelete(
				COMPANY,
				customer.id,
				new Date("2026-10-22T12:00:00.000Z"),
			);

			const history = await request(testApp.app)
				.get(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB));

			expect(created.status).toBe(201);
			expect(history.status).toBe(200);
			expect(history.body).toHaveLength(1);
			expect(history.body[0].customerId).toBe(customer.id);
			// The ledger is the audit trail: deleting the customer never hides
			// the sale.
			expect(history.body[0].customer).toEqual({
				id: customer.id,
				name: "Maria Gonzalez",
			});
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

		it("filters by customerId, returning only that customer's movements", async () => {
			const { app, sales } = await appWithSales();

			const response = await request(app)
				.get(`/companies/${COMPANY}/movements?customerId=${CUSTOMER_ID}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map((movement: { id: string }) => movement.id),
			).toEqual([sales.saleB.id, sales.saleA.id]);
			expect(
				response.body.every(
					(movement: { customerId: string | null }) =>
						movement.customerId === CUSTOMER_ID,
				),
			).toBe(true);
		});

		it("composes the customerId filter with type, so only the sales come back", async () => {
			const { app, sales } = await appWithSales();

			const onlySales = await request(app)
				.get(
					`/companies/${COMPANY}/movements?customerId=${CUSTOMER_ID}&type=OUT`,
				)
				.set("authorization", authorization(OWNER_SUB));
			const onlyEntries = await request(app)
				.get(
					`/companies/${COMPANY}/movements?customerId=${CUSTOMER_ID}&type=IN`,
				)
				.set("authorization", authorization(OWNER_SUB));

			expect(onlySales.status).toBe(200);
			expect(
				onlySales.body.map((movement: { id: string }) => movement.id),
			).toEqual([sales.saleB.id, sales.saleA.id]);
			// The same customer has no entries, so both filters are applied.
			expect(onlyEntries.status).toBe(200);
			expect(onlyEntries.body).toEqual([]);
		});

		it("composes the customerId filter with productId", async () => {
			const { app, sales } = await appWithSales();

			// Both customers bought PRODUCT_A, so the product filter alone would
			// keep both sales and only the customer filter can drop the other
			// one.
			const response = await request(app)
				.get(
					`/companies/${COMPANY}/movements?customerId=${CUSTOMER_ID}&productId=${PRODUCT_A}`,
				)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map((movement: { id: string }) => movement.id),
			).toEqual([sales.saleA.id]);
		});

		it("does not narrow the history when customerId is absent", async () => {
			const { app, sales } = await appWithSales();

			const response = await request(app)
				.get(`/companies/${COMPANY}/movements`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map((movement: { id: string }) => movement.id),
			).toEqual([
				sales.entry.id,
				sales.saleC.id,
				sales.saleB.id,
				sales.saleA.id,
			]);
		});

		it("answers 400 for a malformed customerId", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/movements?customerId=not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
		});

		it("never leaks another company's movements through the customerId filter", async () => {
			const { app } = await appWithSales();

			const ours = await request(app)
				.get(`/companies/${COMPANY}/movements?customerId=${OTHER_CUSTOMER_ID}`)
				.set("authorization", authorization(OWNER_SUB));
			const theirs = await request(app)
				.get(
					`/companies/${OTHER_COMPANY}/movements?customerId=${OTHER_CUSTOMER_ID}`,
				)
				.set("authorization", authorization(OWNER_SUB));

			// A customer of another company is a filter that matches nothing
			// here: no 404 and no rows.
			expect(ours.status).toBe(200);
			expect(ours.body).toEqual([]);
			// The sale does exist under its own company, so the empty answer is
			// the company scoping and not a lost customer.
			expect(theirs.status).toBe(200);
			expect(
				theirs.body.map(
					(movement: { customerId: string }) => movement.customerId,
				),
			).toEqual([OTHER_CUSTOMER_ID]);
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

	describe("GET /companies/:companyId/reports/movements", () => {
		/**
		 * Seeds a movement straight into the ledger: the report reads the range,
		 * so the fixture needs movements with a `createdAt` of its own instead of
		 * whatever the register endpoint stamps.
		 */
		function seedMovement(
			repository: InMemoryStockMovementRepository,
			overrides: Partial<Parameters<typeof StockMovement.create>[0]> = {},
		) {
			const row = StockMovement.create({
				companyId: COMPANY,
				productId: "aaaaaaaa-1111-4111-8111-111111111111",
				userId: "user-1",
				type: "IN",
				quantity: 1,
				createdAt: new Date("2026-10-21T08:00:00.000Z"),
				...overrides,
			});

			repository.save(row);

			return row;
		}

		it("answers 200 with the zero-filled series ending on today's UTC date", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/reports/movements`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			// The contract's default of 30 days, oldest first.
			expect(response.body.days).toBe(30);
			expect(response.body.series).toHaveLength(30);
			expect(response.body.series[0]).toEqual({
				date: "2026-09-22",
				entries: 0,
				exits: 0,
			});
			expect(response.body.series[29]).toEqual({
				date: "2026-10-21",
				entries: 0,
				exits: 0,
			});
		});

		it("honours ?days=7 and sums the quantities of each UTC day", async () => {
			const { app, seedRoster, stockMovementRepository } = createTestApp();
			seedRoster();
			seedMovement(stockMovementRepository, {
				type: "IN",
				quantity: 5,
				createdAt: new Date("2026-10-20T08:00:00.000Z"),
			});
			seedMovement(stockMovementRepository, {
				type: "IN",
				quantity: 3,
				createdAt: new Date("2026-10-20T18:00:00.000Z"),
			});
			seedMovement(stockMovementRepository, {
				type: "OUT",
				quantity: 2,
				createdAt: new Date("2026-10-21T00:01:00.000Z"),
			});

			const response = await request(app)
				.get(`/companies/${COMPANY}/reports/movements?days=7`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				days: 7,
				series: [
					{ date: "2026-10-15", entries: 0, exits: 0 },
					{ date: "2026-10-16", entries: 0, exits: 0 },
					{ date: "2026-10-17", entries: 0, exits: 0 },
					{ date: "2026-10-18", entries: 0, exits: 0 },
					{ date: "2026-10-19", entries: 0, exits: 0 },
					{ date: "2026-10-20", entries: 8, exits: 0 },
					{ date: "2026-10-21", entries: 0, exits: 2 },
				],
			});
		});

		it.each([
			["a days of 0", "days=0"],
			["a days above 90", "days=91"],
			["a non-integer days", "days=1.5"],
			["a non-numeric days", "days=abc"],
		])("answers 400 for %s", async (_label, query) => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/reports/movements?${query}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(400);
		});

		it("answers 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/reports/movements`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("company_access_forbidden");
		});

		it("answers 400 for a malformed company id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get("/companies/not-a-uuid/reports/movements")
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(400);
		});

		it("never counts another company's movements", async () => {
			const testApp = createTestApp();
			testApp.seedRoster();
			// The owner belongs to both companies, so the other company's ledger
			// can be read there and the isolation is observable.
			testApp.seedMembership({
				userId: testApp.owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			seedMovement(testApp.stockMovementRepository, {
				companyId: OTHER_COMPANY,
				type: "IN",
				quantity: 10,
				createdAt: new Date("2026-10-21T09:00:00.000Z"),
			});
			seedMovement(testApp.stockMovementRepository, {
				type: "OUT",
				quantity: 4,
				createdAt: new Date("2026-10-21T10:00:00.000Z"),
			});

			const ours = await request(testApp.app)
				.get(`/companies/${COMPANY}/reports/movements?days=1`)
				.set("authorization", authorization(OWNER_SUB));
			const theirs = await request(testApp.app)
				.get(`/companies/${OTHER_COMPANY}/reports/movements?days=1`)
				.set("authorization", authorization(OWNER_SUB));

			expect(ours.status).toBe(200);
			expect(ours.body.series).toEqual([
				{ date: "2026-10-21", entries: 0, exits: 4 },
			]);
			// The other company does have a movement that day, so the empty
			// entries above are the company scoping and not an empty ledger.
			expect(theirs.status).toBe(200);
			expect(theirs.body.series).toEqual([
				{ date: "2026-10-21", entries: 10, exits: 0 },
			]);
		});
	});
});
