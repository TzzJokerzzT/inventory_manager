import request from "supertest";
import { ListProductUnitsUseCase } from "../src/application/use-cases/list-product-units.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { StockLot } from "../src/domain/entities/stock-lot.js";
import { StockMovement } from "../src/domain/entities/stock-movement.js";
import { User } from "../src/domain/entities/user.js";
import { PRODUCT_NOT_FOUND_CODE } from "../src/domain/errors/product-not-found-error.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryMembershipRepository } from "../src/infrastructure/database/in-memory-membership-repository.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
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
const PRODUCT_ID = "22222222-3333-4444-8555-666666666666";
const FOREIGN_PRODUCT_ID = "33333333-4444-4555-8666-777777777777";
const LONELY_PRODUCT_ID = "44444444-5555-4666-8777-888888888888";
const SUPPLIER_ID = "55555555-6666-4777-8888-999999999999";
const MISSING_PRODUCT_ID = "99999999-9999-4999-8999-999999999999";
const USER_ID = "88888888-9999-4aaa-8bbb-cccccccccccc";

const OWNER_SUB = "auth0|owner";
const MEMBER_SUB = "auth0|member";
const OUTSIDER_SUB = "auth0|outsider";

const OLDER = new Date("2026-10-01T09:00:00.000Z");
const NEWER = new Date("2026-10-05T09:00:00.000Z");

/**
 * `GET /companies/:companyId/products/:productId/units` (L23): the read the sale
 * screen needs to offer the concrete units of a product, behind the same auth and
 * company context as the rest of the product reads.
 */
describe("product unit endpoints", () => {
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
		// One shared store, like the database: the catalogue, the ledger and the
		// lot reads see the same state.
		const store = new Map<string, Product>();
		const productRepository = new InMemoryProductRepository([], store);
		const stockMovementRepository = new InMemoryStockMovementRepository(store);
		const stockLotRepository = new InMemoryStockLotRepository(
			stockMovementRepository,
		);

		const owner = User.create({ auth0Sub: OWNER_SUB, email: "owner@x.com" });
		const member = User.create({ auth0Sub: MEMBER_SUB, email: "member@x.com" });
		const outsider = User.create({
			auth0Sub: OUTSIDER_SUB,
			email: "outsider@x.com",
		});
		const userRepository = createFakeUserRepository([owner, member, outsider]);

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

		productRepository.save(
			Product.create({
				id: PRODUCT_ID,
				companyId: COMPANY,
				name: "Rollo plastico",
				sku: "ROLLO",
				price: "9000.00",
			}),
		);
		productRepository.save(
			Product.create({
				id: LONELY_PRODUCT_ID,
				companyId: COMPANY,
				name: "Sin lotes",
				sku: "SINLOTES",
				price: "9000.00",
			}),
		);
		productRepository.save(
			Product.create({
				id: FOREIGN_PRODUCT_ID,
				companyId: OTHER_COMPANY,
				name: "Rollo ajeno",
				sku: "AJENO",
				price: "9000.00",
			}),
		);

		async function seedLot(options: {
			id: string;
			receivedAt: Date;
			measures: number[];
			costPerMeasure: string;
			productId?: string;
			companyId?: string;
		}): Promise<StockLot> {
			const lot = StockLot.create({
				id: options.id,
				companyId: options.companyId ?? COMPANY,
				productId: options.productId ?? PRODUCT_ID,
				supplierId: SUPPLIER_ID,
				costPerMeasure: options.costPerMeasure,
				measures: options.measures,
				receivedAt: options.receivedAt,
				createdAt: options.receivedAt,
			});

			return stockLotRepository.register(lot, USER_ID);
		}

		/**
		 * The write a sale performs. The endpoint under test only reads, and the
		 * sale path has its own suite, so the ledger is seeded directly.
		 */
		async function sell(unitIds: string[]): Promise<void> {
			const result = await stockMovementRepository.register(
				StockMovement.create({
					companyId: COMPANY,
					productId: PRODUCT_ID,
					type: "OUT",
					quantity: unitIds.length,
					unitPrice: "9000.00",
					unitIds,
					userId: USER_ID,
				}),
			);

			if (result.kind !== "registered") {
				throw new Error(`The seeded sale was rejected: ${result.kind}`);
			}
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
				units: new ListProductUnitsUseCase({
					productRepository,
					stockLotRepository,
				}),
				list: {} as never,
				get: {} as never,
				create: {} as never,
				update: {} as never,
				remove: {} as never,
				restore: {} as never,
				purge: {} as never,
			},
			customers: {} as never,
			movements: {} as never,
			suppliers: {} as never,
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
			seedRoster: () => {
				seedMembership({ userId: owner.id, role: "OWNER" });
				seedMembership({ userId: member.id, role: "MEMBER" });
			},
			seedLot,
			sell,
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	function unitsPath(productId = PRODUCT_ID): string {
		return `/companies/${COMPANY}/products/${productId}/units`;
	}

	/**
	 * Two lots: the older one with two units and the newer one with one, so the
	 * order across lots and inside a lot are both observable.
	 */
	async function seedTwoLots(context: ReturnType<typeof createTestApp>) {
		await context.seedLot({
			id: "lot-new",
			receivedAt: NEWER,
			measures: [3],
			costPerMeasure: "2000.00",
		});
		const older = await context.seedLot({
			id: "lot-old",
			receivedAt: OLDER,
			measures: [2, 4],
			costPerMeasure: "1000.00",
		});

		return older;
	}

	it("answers the AVAILABLE units by default, oldest lot first and by code", async () => {
		const context = createTestApp();
		context.seedRoster();
		await seedTwoLots(context);

		const response = await request(context.app)
			.get(unitsPath())
			.set("authorization", authorization(MEMBER_SUB));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([
			{
				id: expect.any(String),
				code: "R-01",
				measure: "2.000",
				cost: "2000.00",
				status: "AVAILABLE",
				lotId: "lot-old",
				receivedAt: OLDER.toISOString(),
			},
			{
				id: expect.any(String),
				code: "R-02",
				measure: "4.000",
				cost: "4000.00",
				status: "AVAILABLE",
				lotId: "lot-old",
				receivedAt: OLDER.toISOString(),
			},
			{
				id: expect.any(String),
				code: "R-01",
				measure: "3.000",
				cost: "6000.00",
				status: "AVAILABLE",
				lotId: "lot-new",
				receivedAt: NEWER.toISOString(),
			},
		]);
	});

	it("answers only the SOLD units when status=SOLD", async () => {
		const context = createTestApp();
		context.seedRoster();
		const older = await seedTwoLots(context);
		const sold = older.units[1];
		if (sold === undefined) {
			throw new Error("The seeded lot has no second unit");
		}
		await context.sell([sold.id]);

		const response = await request(context.app)
			.get(unitsPath())
			.query({ status: "SOLD" })
			.set("authorization", authorization(MEMBER_SUB));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([
			{
				id: sold.id,
				code: "R-02",
				measure: "4.000",
				cost: "4000.00",
				status: "SOLD",
				lotId: "lot-old",
				receivedAt: OLDER.toISOString(),
			},
		]);
	});

	it("answers both states when status=ALL", async () => {
		const context = createTestApp();
		context.seedRoster();
		const older = await seedTwoLots(context);
		const sold = older.units[1];
		if (sold === undefined) {
			throw new Error("The seeded lot has no second unit");
		}
		await context.sell([sold.id]);

		const response = await request(context.app)
			.get(unitsPath())
			.query({ status: "ALL" })
			.set("authorization", authorization(MEMBER_SUB));

		expect(response.status).toBe(200);
		expect(
			response.body.map(
				(unit: { lotId: string; code: string; status: string }) =>
					`${unit.lotId}/${unit.code}/${unit.status}`,
			),
		).toEqual([
			"lot-old/R-01/AVAILABLE",
			"lot-old/R-02/SOLD",
			"lot-new/R-01/AVAILABLE",
		]);
	});

	it("answers 400 with the issue list for an unknown status", async () => {
		const context = createTestApp();
		context.seedRoster();
		await seedTwoLots(context);

		const response = await request(context.app)
			.get(unitsPath())
			.query({ status: "maybe" })
			.set("authorization", authorization(MEMBER_SUB));

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			error: {
				message: "Invalid request body",
				issues: ["status must be one of AVAILABLE, SOLD or ALL"],
			},
		});
	});

	it("answers an empty array for a product without lots", async () => {
		const context = createTestApp();
		context.seedRoster();

		const response = await request(context.app)
			.get(unitsPath(LONELY_PRODUCT_ID))
			.set("authorization", authorization(MEMBER_SUB));

		expect(response.status).toBe(200);
		expect(response.body).toEqual([]);
	});

	it("answers 404 product_not_found for a product of another company", async () => {
		const context = createTestApp();
		context.seedRoster();
		await context.seedLot({
			id: "lot-foreign",
			receivedAt: OLDER,
			measures: [3],
			costPerMeasure: "1000.00",
			productId: FOREIGN_PRODUCT_ID,
			companyId: OTHER_COMPANY,
		});

		const foreign = await request(context.app)
			.get(unitsPath(FOREIGN_PRODUCT_ID))
			.set("authorization", authorization(MEMBER_SUB));
		const missing = await request(context.app)
			.get(unitsPath(MISSING_PRODUCT_ID))
			.set("authorization", authorization(MEMBER_SUB));
		const malformed = await request(context.app)
			.get(unitsPath("not-a-uuid"))
			.set("authorization", authorization(MEMBER_SUB));

		expect(foreign.status).toBe(404);
		expect(foreign.body).toEqual({
			error: {
				message: expect.any(String),
				code: PRODUCT_NOT_FOUND_CODE,
			},
		});
		// The same answer for an id that does not exist anywhere: the endpoint
		// cannot be used to probe another company's catalogue.
		expect(missing.status).toBe(404);
		expect(missing.body).toEqual(foreign.body);
		expect(malformed.status).toBe(400);
	});

	it("answers 401 without a token", async () => {
		const context = createTestApp();
		context.seedRoster();

		const response = await request(context.app).get(unitsPath());

		expect(response.status).toBe(401);
	});

	it("answers 403 for a caller without a membership in the company", async () => {
		const context = createTestApp();
		context.seedRoster();

		const response = await request(context.app)
			.get(unitsPath())
			.set("authorization", authorization(OUTSIDER_SUB));

		expect(response.status).toBe(403);
	});
});
