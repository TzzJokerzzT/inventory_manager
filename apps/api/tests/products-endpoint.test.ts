import request from "supertest";
import { CreateProductUseCase } from "../src/application/use-cases/create-product.js";
import { DeleteProductUseCase } from "../src/application/use-cases/delete-product.js";
import { GetProductUseCase } from "../src/application/use-cases/get-product.js";
import { ListProductsUseCase } from "../src/application/use-cases/list-products.js";
import { UpdateProductUseCase } from "../src/application/use-cases/update-product.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
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

const MISSING_PRODUCT_ID = "12345678-1234-4123-8123-123456789012";

describe("product endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const membershipRepository = new InMemoryMembershipRepository();
		const productRepository = new InMemoryProductRepository();

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
			updateUserFullName: {} as never,
			products: {
				list: new ListProductsUseCase({ productRepository }),
				create: new CreateProductUseCase({ productRepository }),
				get: new GetProductUseCase({ productRepository }),
				update: new UpdateProductUseCase({ productRepository }),
				remove: new DeleteProductUseCase({ productRepository }),
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
				categoryId: null,
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			});
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

		it("ignores stock, the low-stock threshold and the category in the body", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const body = await createProduct(app, {
				stockQuantity: 99,
				lowStockThreshold: 5,
				categoryId: "22222222-3333-4444-8555-666666666666",
			});

			expect(body.stockQuantity).toBe(0);
			expect(body.lowStockThreshold).toBe(0);
			expect(body.categoryId).toBeNull();
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
			expect(response.body).toEqual(product);
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
});
