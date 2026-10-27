import request from "supertest";
import { CreateCategoryUseCase } from "../src/application/use-cases/create-category.js";
import { DeleteCategoryUseCase } from "../src/application/use-cases/delete-category.js";
import { ListCategoriesUseCase } from "../src/application/use-cases/list-categories.js";
import { UpdateCategoryUseCase } from "../src/application/use-cases/update-category.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCategoryRepository } from "../src/infrastructure/database/in-memory-category-repository.js";
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

const MISSING_CATEGORY_ID = "12345678-1234-4123-8123-123456789012";

describe("category endpoints", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	function createTestApp() {
		const membershipRepository = new InMemoryMembershipRepository();
		// The category adapter counts the products of the company that point at a
		// category before allowing a delete, so both share one product store.
		const productRepository = new InMemoryProductRepository();
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
			suppliers: {} as never,
			categories: {
				list: new ListCategoriesUseCase({ categoryRepository }),
				create: new CreateCategoryUseCase({ categoryRepository }),
				update: new UpdateCategoryUseCase({ categoryRepository }),
				remove: new DeleteCategoryUseCase({ categoryRepository }),
			},
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
			/** A product of the company pointing at a category, active or deleted. */
			seedProduct: (
				categoryId: string,
				options: { deleted?: boolean } = {},
			) => {
				productRepository.save(
					Product.create({
						id: "33333333-4444-4555-8666-777777777777",
						companyId: COMPANY,
						name: "Harina 000",
						sku: "HAR-000",
						price: "100.00",
						categoryId,
						deletedAt: options.deleted
							? new Date("2026-10-22T12:00:00.000Z")
							: null,
					}),
				);
			},
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	async function createCategory(
		app: ReturnType<typeof createTestApp>["app"],
		overrides: Record<string, unknown> = {},
		as: string = OWNER_SUB,
	): Promise<Record<string, unknown>> {
		const response = await request(app)
			.post(`/companies/${COMPANY}/categories`)
			.set("authorization", authorization(as))
			.send({ name: "Bebidas", ...overrides });

		expect(response.status).toBe(201);

		return response.body;
	}

	async function listNames(
		app: ReturnType<typeof createTestApp>["app"],
	): Promise<string[]> {
		const response = await request(app)
			.get(`/companies/${COMPANY}/categories`)
			.set("authorization", authorization(OWNER_SUB));

		expect(response.status).toBe(200);

		return response.body.map((category: { name: string }) => category.name);
	}

	describe("POST /companies/:companyId/categories", () => {
		it("creates a category and answers 201 with the contract shape", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "  Bebidas  " });

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				id: expect.any(String),
				companyId: COMPANY,
				name: "Bebidas",
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			});
		});

		it("lets an ADMIN create, because writing is `manage_products`", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const body = await createCategory(app, {}, ADMIN_SUB);

			expect(body.name).toBe("Bebidas");
		});

		it("drops an unknown body key instead of storing it", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(OWNER_SUB))
				.send({
					name: "Bebidas",
					companyId: OTHER_COMPANY,
					createdAt: "2020-01-01T00:00:00.000Z",
				});

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				id: expect.any(String),
				// The company comes from the resolved context, never from the body.
				companyId: COMPANY,
				name: "Bebidas",
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			});
		});

		it("answers 403 insufficient_role for a MEMBER and stores nothing", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ name: "Bebidas" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
			expect(await listNames(app)).toEqual([]);
		});

		it("answers 409 category_name_already_exists and keeps the first row", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createCategory(app);

			const response = await request(app)
				.post(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Bebidas" });

			expect(response.status).toBe(409);
			expect(response.body.error).toEqual({
				message: "A category with that name already exists in the company",
				code: "category_name_already_exists",
			});
			expect(await listNames(app)).toEqual(["Bebidas"]);
		});

		it.each([
			["a missing name", {}],
			["an empty name", { name: "   " }],
			["a name over 120 characters", { name: "a".repeat(121) }],
		])("answers 400 with issues for %s", async (_label, body) => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(OWNER_SUB))
				.send(body);

			expect(response.status).toBe(400);
			expect(response.body.error.issues.length).toBeGreaterThan(0);
			expect(await listNames(app)).toEqual([]);
		});

		it("answers 400 for a malformed company id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.post("/companies/not-a-uuid/categories")
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Bebidas" });

			expect(response.status).toBe(400);
		});

		it("answers 401 without a token and 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const withoutToken = await request(app).post(
				`/companies/${COMPANY}/categories`,
			);
			const outsider = await request(app)
				.post(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(OUTSIDER_SUB))
				.send({ name: "Bebidas" });

			expect(withoutToken.status).toBe(401);
			expect(outsider.status).toBe(403);
			expect(outsider.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("GET /companies/:companyId/categories", () => {
		it("lists the company's categories ordered by name and then id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createCategory(app, { name: "Zeta" });
			await createCategory(app, { name: "Alfa" });

			const response = await request(app)
				.get(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(200);
			expect(
				response.body.map((category: { name: string }) => category.name),
			).toEqual(["Alfa", "Zeta"]);
		});

		it("never lists another company's categories", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			// The same OWNER belongs to both companies, so only the company filter
			// separates the two catalogues.
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			await createCategory(app, { name: "Propia" });
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/categories`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajena" });

			expect(foreign.status).toBe(201);
			expect(await listNames(app)).toEqual(["Propia"]);
		});

		it("answers 403 for a non-member", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.get(`/companies/${COMPANY}/categories`)
				.set("authorization", authorization(OUTSIDER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("company_access_forbidden");
		});
	});

	describe("PATCH /companies/:companyId/categories/:categoryId", () => {
		it("renames the category and answers 200 with it", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const category = await createCategory(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(ADMIN_SUB))
				.send({ name: "  Almacén  " });

			expect(response.status).toBe(200);
			expect(response.body).toMatchObject({
				id: category.id,
				companyId: COMPANY,
				name: "Almacén",
			});
		});

		it("answers 409 category_name_already_exists and keeps the old name", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			await createCategory(app, { name: "Bebidas" });
			const second = await createCategory(app, { name: "Almacén" });

			const response = await request(app)
				.patch(`/companies/${COMPANY}/categories/${second.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Bebidas" });

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("category_name_already_exists");
			expect(await listNames(app)).toEqual(["Almacén", "Bebidas"]);
		});

		it("answers 403 insufficient_role for a MEMBER and keeps the row", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const category = await createCategory(app);

			const response = await request(app)
				.patch(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(MEMBER_SUB))
				.send({ name: "Almacén" });

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
			expect(await listNames(app)).toEqual(["Bebidas"]);
		});

		it("answers 404 category_not_found for a category that does not exist", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();

			const response = await request(app)
				.patch(`/companies/${COMPANY}/categories/${MISSING_CATEGORY_ID}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Almacén" });

			expect(response.status).toBe(404);
			expect(response.body.error).toEqual({
				message: "Category not found",
				code: "category_not_found",
			});
		});

		it("answers the same 404 for another company's category and leaves it untouched", async () => {
			const { app, seedRoster, seedMembership, owner } = createTestApp();
			seedRoster();
			seedMembership({
				userId: owner.id,
				role: "OWNER",
				companyId: OTHER_COMPANY,
			});
			const foreign = await request(app)
				.post(`/companies/${OTHER_COMPANY}/categories`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Ajena" });

			const response = await request(app)
				.patch(`/companies/${COMPANY}/categories/${foreign.body.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Almacén" });

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("category_not_found");
		});

		it("answers 400 for an invalid body and for a malformed category id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const category = await createCategory(app);

			const badBody = await request(app)
				.patch(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "   " });
			const badId = await request(app)
				.patch(`/companies/${COMPANY}/categories/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB))
				.send({ name: "Almacén" });

			expect(badBody.status).toBe(400);
			expect(badId.status).toBe(400);
			expect(await listNames(app)).toEqual(["Bebidas"]);
		});
	});

	describe("DELETE /companies/:companyId/categories/:categoryId", () => {
		it("hard-deletes and answers 204, then the category is gone from the list", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const category = await createCategory(app);

			const deleted = await request(app)
				.delete(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(ADMIN_SUB));

			expect(deleted.status).toBe(204);
			expect(deleted.text).toBe("");
			expect(await listNames(app)).toEqual([]);
		});

		it("answers 409 category_in_use while a product references it, and keeps the category", async () => {
			const { app, seedRoster, seedProduct } = createTestApp();
			seedRoster();
			const category = await createCategory(app);
			seedProduct(category.id as string);

			const response = await request(app)
				.delete(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error).toEqual({
				message: "Category is in use by 1 product and cannot be deleted",
				code: "category_in_use",
			});
			expect(await listNames(app)).toEqual(["Bebidas"]);
		});

		it("answers 409 category_in_use when only a soft-deleted product references it", async () => {
			const { app, seedRoster, seedProduct } = createTestApp();
			seedRoster();
			const category = await createCategory(app);
			seedProduct(category.id as string, { deleted: true });

			const response = await request(app)
				.delete(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("category_in_use");
		});

		it("answers 404 category_not_found on a second delete", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const category = await createCategory(app);

			await request(app)
				.delete(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(OWNER_SUB));
			const second = await request(app)
				.delete(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(OWNER_SUB));

			expect(second.status).toBe(404);
			expect(second.body.error.code).toBe("category_not_found");
		});

		it("answers 403 insufficient_role for a MEMBER and keeps the row", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const category = await createCategory(app);

			const response = await request(app)
				.delete(`/companies/${COMPANY}/categories/${category.id}`)
				.set("authorization", authorization(MEMBER_SUB));

			expect(response.status).toBe(403);
			expect(response.body.error.code).toBe("insufficient_role");
			expect(await listNames(app)).toEqual(["Bebidas"]);
		});

		it("answers 401 without a token and 400 for a malformed category id", async () => {
			const { app, seedRoster } = createTestApp();
			seedRoster();
			const category = await createCategory(app);

			const withoutToken = await request(app).delete(
				`/companies/${COMPANY}/categories/${category.id}`,
			);
			const badId = await request(app)
				.delete(`/companies/${COMPANY}/categories/not-a-uuid`)
				.set("authorization", authorization(OWNER_SUB));

			expect(withoutToken.status).toBe(401);
			expect(badId.status).toBe(400);
			expect(await listNames(app)).toEqual(["Bebidas"]);
		});
	});
});
