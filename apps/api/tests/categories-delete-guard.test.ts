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

/**
 * The three guard branches of `DELETE /companies/:companyId/categories/:categoryId`
 * that the endpoint suite leaves implicit: the role check before any read, the
 * soft-deleted product counting as "in use", and the foreign category that must
 * stay untouched in its own company.
 */
const TEST_WEB_ORIGIN = "http://localhost:3000";
const COMPANY = "11111111-2222-4333-8444-555555555555";
const OTHER_COMPANY = "99999999-8888-4777-8666-555555555555";

const OWNER_SUB = "auth0|owner";
const ADMIN_SUB = "auth0|admin";
const MEMBER_SUB = "auth0|member";

const MISSING_CATEGORY_ID = "12345678-1234-4123-8123-123456789012";

describe("delete category guards", () => {
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
		const userRepository = createFakeUserRepository([owner, admin, member]);

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

		let productSequence = 0;

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
				productSequence += 1;
				productRepository.save(
					Product.create({
						id: `33333333-4444-4555-8666-7777777777${String(
							productSequence,
						).padStart(2, "0")}`,
						companyId: COMPANY,
						name: `Harina 000 ${productSequence}`,
						sku: `HAR-000-${productSequence}`,
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
		companyId: string = COMPANY,
	): Promise<string[]> {
		const response = await request(app)
			.get(`/companies/${companyId}/categories`)
			.set("authorization", authorization(OWNER_SUB));

		expect(response.status).toBe(200);

		return response.body.map((category: { name: string }) => category.name);
	}

	it("answers 403 insufficient_role when a MEMBER deletes an absent category", async () => {
		const { app, seedRoster } = createTestApp();
		seedRoster();

		const response = await request(app)
			.delete(`/companies/${COMPANY}/categories/${MISSING_CATEGORY_ID}`)
			.set("authorization", authorization(MEMBER_SUB));

		// The role is decided before any read, so the MEMBER never learns whether
		// the id it named exists: the answer is the role 403, never the 404 an
		// absent category gets for an OWNER.
		expect(response.status).toBe(403);
		expect(response.body.error).toEqual({
			message: "Insufficient role for this action",
			code: "insufficient_role",
		});
		expect(await listNames(app)).toEqual([]);
	});

	it("answers 409 category_in_use with the count when only soft-deleted products reference it", async () => {
		const { app, seedRoster, seedProduct } = createTestApp();
		seedRoster();
		const category = await createCategory(app);
		// Both products are in the trash, so only the count that ignores
		// `deletedAt` can see them; the `RESTRICT` foreign key covers them too.
		seedProduct(category.id as string, { deleted: true });
		seedProduct(category.id as string, { deleted: true });

		const response = await request(app)
			.delete(`/companies/${COMPANY}/categories/${category.id}`)
			.set("authorization", authorization(OWNER_SUB));

		expect(response.status).toBe(409);
		expect(response.body.error).toEqual({
			message: "Category is in use by 2 products and cannot be deleted",
			code: "category_in_use",
		});
		// The blocked delete removed nothing: the category is still there.
		expect(await listNames(app)).toEqual(["Bebidas"]);
	});

	it("answers 404 category_not_found for another company's category and keeps it in its own company", async () => {
		const { app, seedRoster, seedMembership, owner } = createTestApp();
		seedRoster();
		// The same OWNER belongs to both companies, so only the company filter
		// decides that the category cannot be deleted from `COMPANY`.
		seedMembership({
			userId: owner.id,
			role: "OWNER",
			companyId: OTHER_COMPANY,
		});
		const foreign = await request(app)
			.post(`/companies/${OTHER_COMPANY}/categories`)
			.set("authorization", authorization(OWNER_SUB))
			.send({ name: "Ajena" });

		expect(foreign.status).toBe(201);

		const response = await request(app)
			.delete(`/companies/${COMPANY}/categories/${foreign.body.id}`)
			.set("authorization", authorization(OWNER_SUB));

		expect(response.status).toBe(404);
		expect(response.body.error).toEqual({
			message: "Category not found",
			code: "category_not_found",
		});
		// The guarded delete matched no row of the caller's company, so the
		// category is still readable where it belongs.
		expect(await listNames(app, OTHER_COMPANY)).toEqual(["Ajena"]);
		expect(await listNames(app)).toEqual([]);
	});
});
