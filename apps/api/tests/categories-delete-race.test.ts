import request from "supertest";
import { DeleteCategoryUseCase } from "../src/application/use-cases/delete-category.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { User } from "../src/domain/entities/user.js";
import type {
	CategoryRepository,
	DeleteCategoryResult,
} from "../src/domain/repositories/category-repository.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
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

/**
 * The race branch of the delete (S4): the count saw nothing, a product started
 * pointing at the category before the `DELETE`, and the store reported `in_use`
 * -- what the Prisma adapter translates from the `P2003` the `RESTRICT` foreign
 * key raises. The in-memory adapter cannot be told to lose that race (it
 * re-counts before removing the row), so the branch is pinned through the port
 * with a stub, exactly at the boundary the use case depends on.
 *
 * The other two results of the port are pinned here too, because they share the
 * same `switch`: `not_found` is the 404 and `deleted` is the 204.
 */
const TEST_WEB_ORIGIN = "http://localhost:3000";
const COMPANY = "11111111-2222-4333-8444-555555555555";

const OWNER_SUB = "auth0|owner";

const CATEGORY_ID = "12345678-1234-4123-8123-123456789012";

describe("delete category race", () => {
	let issuer: LocalIssuer;

	beforeAll(async () => {
		issuer = await startLocalIssuer();
	});

	afterAll(async () => {
		await issuer.close();
	});

	/**
	 * A `CategoryRepository` double whose count answers the queue in order and
	 * whose delete answers the scripted result, so the test decides what the
	 * count saw and what the store rejected.
	 */
	function stubCategoryRepository(options: {
		counts: number[];
		deleteResult: DeleteCategoryResult;
	}) {
		const counts = [...options.counts];
		const countProducts = jest.fn(async () => {
			const next = counts.length > 1 ? counts.shift() : counts[0];

			return next ?? 0;
		});
		const remove = jest.fn(async () => options.deleteResult);

		const repository = {
			create: jest.fn(),
			findById: jest.fn(),
			findByIds: jest.fn(),
			listByCompany: jest.fn(),
			update: jest.fn(),
			countProducts,
			delete: remove,
		} as unknown as CategoryRepository;

		return { repository, countProducts, remove };
	}

	function createTestApp(categoryRepository: CategoryRepository) {
		const membershipRepository = new InMemoryMembershipRepository();
		const owner = User.create({ auth0Sub: OWNER_SUB, email: "owner@x.com" });
		const userRepository = createFakeUserRepository([owner]);

		function seedMembership(options: {
			userId: string;
			role: MembershipRole;
		}): void {
			membershipRepository.save(
				Membership.create({
					userId: options.userId,
					invitedEmail: "someone@x.com",
					companyId: COMPANY,
					role: options.role,
					status: "ACTIVE",
					invitedBy: owner.id,
					acceptedAt: new Date(),
				}),
			);
		}

		const companyRepository = new InMemoryCompanyRepository();
		companyRepository.save(Company.create({ id: COMPANY, name: "Acme" }));

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
				list: {} as never,
				create: {} as never,
				update: {} as never,
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
			seedRoster: () => {
				seedMembership({ userId: owner.id, role: "OWNER" });
			},
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	async function removeCategory(
		app: ReturnType<typeof createTestApp>["app"],
	): Promise<request.Response> {
		return request(app)
			.delete(`/companies/${COMPANY}/categories/${CATEGORY_ID}`)
			.set("authorization", authorization(OWNER_SUB));
	}

	it("answers 409 category_in_use with the re-counted number when the delete loses the race", async () => {
		const { repository, countProducts, remove } = stubCategoryRepository({
			// The guard read saw nobody; the product appeared afterwards.
			counts: [0, 3],
			deleteResult: "in_use",
		});
		const { app, seedRoster } = createTestApp(repository);
		seedRoster();

		const response = await removeCategory(app);

		expect(response.status).toBe(409);
		expect(response.body.error).toEqual({
			// The number comes from the re-count after the rejected delete, never
			// from the zero the guard read saw.
			message: "Category is in use by 3 products and cannot be deleted",
			code: "category_in_use",
		});
		// One guarded attempt: the rejected delete is never retried.
		expect(remove).toHaveBeenCalledTimes(1);
		expect(remove).toHaveBeenCalledWith(COMPANY, CATEGORY_ID);
		expect(countProducts).toHaveBeenCalledTimes(2);
	});

	it("answers 409 with a count of 1 when the re-count sees nothing", async () => {
		const { repository, remove } = stubCategoryRepository({
			// The product was removed again between the delete and the re-count, so
			// only the rejected foreign key proves there was at least one.
			counts: [0, 0],
			deleteResult: "in_use",
		});
		const { app, seedRoster } = createTestApp(repository);
		seedRoster();

		const response = await removeCategory(app);

		expect(response.status).toBe(409);
		expect(response.body.error).toEqual({
			message: "Category is in use by 1 product and cannot be deleted",
			code: "category_in_use",
		});
		expect(remove).toHaveBeenCalledTimes(1);
	});

	it("maps a not_found delete result to 404 category_not_found", async () => {
		const { repository, remove } = stubCategoryRepository({
			counts: [0],
			deleteResult: "not_found",
		});
		const { app, seedRoster } = createTestApp(repository);
		seedRoster();

		const response = await removeCategory(app);

		expect(response.status).toBe(404);
		expect(response.body.error).toEqual({
			message: "Category not found",
			code: "category_not_found",
		});
		expect(remove).toHaveBeenCalledTimes(1);
	});

	it("maps a deleted delete result to 204 with no body", async () => {
		const { repository, remove } = stubCategoryRepository({
			counts: [0],
			deleteResult: "deleted",
		});
		const { app, seedRoster } = createTestApp(repository);
		seedRoster();

		const response = await removeCategory(app);

		expect(response.status).toBe(204);
		expect(response.text).toBe("");
		expect(response.body).toEqual({});
		expect(remove).toHaveBeenCalledTimes(1);
	});
});
