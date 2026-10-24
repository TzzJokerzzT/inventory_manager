import request from "supertest";
import { RegisterLotUseCase } from "../src/application/use-cases/register-lot.js";
import { RegisterStockMovementUseCase } from "../src/application/use-cases/register-stock-movement.js";
import { Company } from "../src/domain/entities/company.js";
import {
	Membership,
	type MembershipRole,
} from "../src/domain/entities/membership.js";
import { Product } from "../src/domain/entities/product.js";
import { StockLot } from "../src/domain/entities/stock-lot.js";
import { Supplier } from "../src/domain/entities/supplier.js";
import { User } from "../src/domain/entities/user.js";
import { InMemoryCompanyRepository } from "../src/infrastructure/database/in-memory-company-repository.js";
import { InMemoryCustomerRepository } from "../src/infrastructure/database/in-memory-customer-repository.js";
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

const ROLL_PRODUCT = "a1a1a1a1-1111-4111-8111-111111111111";
const OTHER_ROLL_PRODUCT = "b2b2b2b2-2222-4222-8222-222222222222";
const FOREIGN_ROLL_PRODUCT = "c3c3c3c3-3333-4333-8333-333333333333";
const LOOSE_PRODUCT = "d4d4d4d4-4444-4444-8444-444444444444";
const SUPPLIER = "e5e5e5e5-5555-4555-8555-555555555555";
const OTHER_SUPPLIER = "f6f6f6f6-6666-4666-8666-666666666666";

const OWNER_SUB = "auth0|owner";
const MEMBER_SUB = "auth0|member";

/** Three rolls of 5, 3 and 2 measures, bought at 1000 per measure. */
const MEASURES = [5, 3, 2];

const ROLL_A_UNIT = "f0f0f0f0-0000-4000-8000-000000000001";

/**
 * The sale slice of the movements endpoint: a product loaded in purchase lots
 * can only be sold with the price written on the sale and with the rolls it
 * takes (S1, S2, L9, L10).
 *
 * It is its own suite -- and its own app per case -- for the same reason the
 * other endpoint suites build one: the in-memory adapters share one store per
 * app, so a case never sees the rows of another. The global rate limiter is a
 * per-file counter, and this file keeps its own budget.
 */
describe("sale of a lot-managed product", () => {
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
		const customerRepository = new InMemoryCustomerRepository();

		const owner = User.create({
			auth0Sub: OWNER_SUB,
			email: "owner@x.com",
			fullName: "Olivia Owner",
		});
		const member = User.create({ auth0Sub: MEMBER_SUB, email: "member@x.com" });
		const userRepository = createFakeUserRepository([owner, member]);

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
		// The owner belongs to the other company too, so the fixture can register
		// the lot that proves the cross-company rejection.
		seedMembership({ userId: owner.id, role: "OWNER" });
		seedMembership({ userId: member.id, role: "MEMBER" });
		seedMembership({
			userId: owner.id,
			role: "OWNER",
			companyId: OTHER_COMPANY,
		});

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
			// Not exercised here: this suite only writes movements and lots.
			products: {} as never,
			customers: {} as never,
			movements: {
				register: new RegisterStockMovementUseCase({
					productRepository,
					stockMovementRepository,
					customerRepository,
				}),
				list: {} as never,
				trend: {} as never,
			},
			suppliers: {} as never,
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
			owner,
			member,
			productRepository,
			stockMovementRepository,
			stockLotRepository,
			supplierRepository,
		};
	}

	function authorization(sub: string): string {
		return `Bearer ${issuer.signToken({ sub })}`;
	}

	type TestApp = ReturnType<typeof createTestApp>;

	/** The standard fixture: two products of each company and their suppliers. */
	function setup(): TestApp {
		const testApp = createTestApp();

		testApp.productRepository.save(
			Product.create({
				id: ROLL_PRODUCT,
				companyId: COMPANY,
				name: "Rollo plastico",
				sku: "ROLLO-1",
				price: "9000",
			}),
		);
		testApp.productRepository.save(
			Product.create({
				id: OTHER_ROLL_PRODUCT,
				companyId: COMPANY,
				name: "Rollo negro",
				sku: "ROLLO-2",
				price: "9000",
			}),
		);
		testApp.productRepository.save(
			Product.create({
				id: FOREIGN_ROLL_PRODUCT,
				companyId: OTHER_COMPANY,
				name: "Rollo ajeno",
				sku: "ROLLO-3",
				price: "9000",
			}),
		);
		// A product that never came in a lot: the legacy, quantity-only sale.
		testApp.productRepository.save(
			Product.create({
				id: LOOSE_PRODUCT,
				companyId: COMPANY,
				name: "Cafe molido 500g",
				sku: "CAF-500",
				price: "1500",
				stockQuantity: 10,
			}),
		);
		testApp.supplierRepository.save(
			Supplier.create({ id: SUPPLIER, companyId: COMPANY, name: "Sur" }),
		);
		testApp.supplierRepository.save(
			Supplier.create({
				id: OTHER_SUPPLIER,
				companyId: OTHER_COMPANY,
				name: "Globex Films",
			}),
		);

		return testApp;
	}

	/** Seeds a purchase lot straight into the store, with no HTTP round trip. */
	async function seedLot(
		testApp: TestApp,
		options: {
			productId?: string;
			companyId?: string;
			supplierId?: string;
			measures?: number[];
		} = {},
	): Promise<StockLot> {
		const lot = StockLot.create({
			companyId: options.companyId ?? COMPANY,
			productId: options.productId ?? ROLL_PRODUCT,
			supplierId: options.supplierId ?? SUPPLIER,
			costPerMeasure: "1000",
			measures: options.measures ?? MEASURES,
		});

		return testApp.stockLotRepository.register(lot, testApp.owner.id);
	}

	function sell(testApp: TestApp, body: Record<string, unknown>) {
		return request(testApp.app)
			.post(`/companies/${COMPANY}/movements`)
			.set("authorization", authorization(MEMBER_SUB))
			.send(body);
	}

	/**
	 * The rejected sale left neither a roll marked, nor a sale in the ledger,
	 * nor a stock change behind (MOV-04, S8).
	 */
	async function expectNothingSold(
		testApp: TestApp,
		stockQuantity: number,
	): Promise<void> {
		expect(
			testApp.stockMovementRepository
				.listUnits()
				.every((unit) => unit.status === "AVAILABLE"),
		).toBe(true);
		await expect(
			testApp.productRepository.findActiveById(COMPANY, ROLL_PRODUCT),
		).resolves.toMatchObject({ stockQuantity });
		await expect(
			testApp.stockMovementRepository.findByCompany(COMPANY, {
				type: "OUT",
				limit: 50,
			}),
		).resolves.toEqual([]);
	}

	it("sells rolls at the written price and marks the chosen units SOLD", async () => {
		const testApp = setup();
		// The lot is registered through the endpoint here: it is the only path a
		// real caller takes to bring units in.
		const lotResponse = await request(testApp.app)
			.post(`/companies/${COMPANY}/lots`)
			.set("authorization", authorization(OWNER_SUB))
			.send({
				productId: ROLL_PRODUCT,
				supplierId: SUPPLIER,
				costPerMeasure: "1000",
				measures: MEASURES,
			});
		expect(lotResponse.status).toBe(201);
		const [first, second, third] = lotResponse.body.units as Array<{
			id: string;
		}>;

		const response = await sell(testApp, {
			productId: ROLL_PRODUCT,
			type: "OUT",
			quantity: 2,
			unitPrice: "2500",
			unitIds: [first.id, second.id],
		});

		expect(response.status).toBe(201);
		expect(response.body.unitPrice).toBe("2500.00");
		// The rolls carry their own cost, which is what makes the margin of this
		// sale computable later (S3): the price is the same for all of them, the
		// cost is not.
		expect(response.body.units).toEqual([
			{ id: first.id, code: "R-01", measure: "5.000", cost: "5000.00" },
			{ id: second.id, code: "R-02", measure: "3.000", cost: "3000.00" },
		]);
		expect(response.body.lotId).toBeNull();
		// The stock counts rolls (S7): two of the three left.
		expect(response.body.stockQuantity).toBe(1);
		await expect(
			testApp.productRepository.findActiveById(COMPANY, ROLL_PRODUCT),
		).resolves.toMatchObject({ stockQuantity: 1 });

		const units = testApp.stockMovementRepository.listUnits();
		expect(
			units
				.filter((unit) => unit.status === "SOLD")
				.map((unit) => unit.id)
				.sort(),
		).toEqual([first.id, second.id].sort());
		expect(units.find((unit) => unit.id === third.id)?.status).toBe(
			"AVAILABLE",
		);

		// The link rows are what the reading of the sale exposes: they are the
		// margin's input, so they have to be readable after the write.
		const unitsByMovement =
			await testApp.stockMovementRepository.findUnitsByMovementIds(COMPANY, [
				response.body.id,
			]);
		expect(unitsByMovement.get(response.body.id)).toEqual(response.body.units);
	});

	it.each([
		[
			"a quantity that does not match the units",
			{ quantity: 3, unitPrice: "2500", unitIds: [0, 1] },
		],
		["no unitPrice", { quantity: 2, unitIds: [0, 1] }],
		["no unitIds", { quantity: 2, unitPrice: "2500" }],
	])(
		"answers 400 units_required for %s and writes nothing",
		async (_label, overrides) => {
			const testApp = setup();
			const lot = await seedLot(testApp);
			const { unitIds, ...rest } = overrides as {
				quantity: number;
				unitPrice?: string;
				unitIds?: number[];
			};

			const response = await sell(testApp, {
				productId: ROLL_PRODUCT,
				type: "OUT",
				...rest,
				...(unitIds === undefined
					? {}
					: { unitIds: unitIds.map((index) => lot.units[index].id) }),
			});

			expect(response.status).toBe(400);
			expect(response.body.error.code).toBe("units_required");
			await expectNothingSold(testApp, MEASURES.length);
		},
	);

	it("answers 409 unit_not_available for a unit of another product", async () => {
		const testApp = setup();
		await seedLot(testApp);
		const otherLot = await seedLot(testApp, { productId: OTHER_ROLL_PRODUCT });

		const response = await sell(testApp, {
			productId: ROLL_PRODUCT,
			type: "OUT",
			quantity: 1,
			unitPrice: "2500",
			unitIds: [otherLot.units[0].id],
		});

		expect(response.status).toBe(409);
		expect(response.body.error.code).toBe("unit_not_available");
		await expectNothingSold(testApp, MEASURES.length);
	});

	it("answers 409 unit_not_available for another company's unit, never a 404", async () => {
		const testApp = setup();
		await seedLot(testApp);
		const foreignLot = await seedLot(testApp, {
			productId: FOREIGN_ROLL_PRODUCT,
			companyId: OTHER_COMPANY,
			supplierId: OTHER_SUPPLIER,
		});

		const response = await sell(testApp, {
			productId: ROLL_PRODUCT,
			type: "OUT",
			quantity: 1,
			unitPrice: "2500",
			unitIds: [foreignLot.units[0].id],
		});

		// The other company's product is never confirmed nor denied: the answer is
		// about the unit the caller named, not about a resource of another company.
		expect(response.status).toBe(409);
		expect(response.body.error.code).toBe("unit_not_available");
		await expectNothingSold(testApp, MEASURES.length);
	});

	it("answers 409 when the same roll is sold twice and writes nothing the second time", async () => {
		const testApp = setup();
		const lot = await seedLot(testApp);
		const roll = lot.units[0];

		const firstSale = await sell(testApp, {
			productId: ROLL_PRODUCT,
			type: "OUT",
			quantity: 1,
			unitPrice: "2500",
			unitIds: [roll.id],
		});
		const secondSale = await sell(testApp, {
			productId: ROLL_PRODUCT,
			type: "OUT",
			quantity: 1,
			unitPrice: "2500",
			unitIds: [roll.id],
		});

		expect(firstSale.status).toBe(201);
		expect(secondSale.status).toBe(409);
		expect(secondSale.body.error.code).toBe("unit_not_available");
		// Only the first sale is in the ledger and the stock only moved once.
		const history = await testApp.stockMovementRepository.findByCompany(
			COMPANY,
			{ type: "OUT", limit: 50 },
		);
		expect(history.map((movement) => movement.id)).toEqual([firstSale.body.id]);
		await expect(
			testApp.productRepository.findActiveById(COMPANY, ROLL_PRODUCT),
		).resolves.toMatchObject({ stockQuantity: MEASURES.length - 1 });
		expect(
			testApp.stockMovementRepository
				.listUnits()
				.filter((unit) => unit.status === "SOLD"),
		).toHaveLength(1);
	});

	it("keeps the quantity-only sale of a product without units working", async () => {
		const testApp = setup();

		const response = await sell(testApp, {
			productId: LOOSE_PRODUCT,
			type: "OUT",
			quantity: 4,
		});

		// L9: a product that never came in a lot keeps today's behaviour -- no
		// price and no units are required, and none are invented.
		expect(response.status).toBe(201);
		expect(response.body.unitPrice).toBeNull();
		expect(response.body.units).toEqual([]);
		expect(response.body.lotId).toBeNull();
		expect(response.body.stockQuantity).toBe(6);
	});

	it("keeps an entry on a product with units working without naming any", async () => {
		const testApp = setup();
		await seedLot(testApp);

		const response = await request(testApp.app)
			.post(`/companies/${COMPANY}/movements`)
			.set("authorization", authorization(OWNER_SUB))
			.send({ productId: ROLL_PRODUCT, type: "IN", quantity: 1 });

		// L9 is a rule about sales: an entry keeps adding stock the way it always
		// did, with no price and without touching any roll.
		expect(response.status).toBe(201);
		expect(response.body.units).toEqual([]);
		expect(response.body.unitPrice).toBeNull();
		expect(response.body.stockQuantity).toBe(MEASURES.length + 1);
		expect(
			testApp.stockMovementRepository
				.listUnits()
				.every((unit) => unit.status === "AVAILABLE"),
		).toBe(true);
	});

	it("answers 400 unit_price_requires_exit for an IN with a unitPrice", async () => {
		const testApp = setup();

		const response = await request(testApp.app)
			.post(`/companies/${COMPANY}/movements`)
			.set("authorization", authorization(OWNER_SUB))
			.send({
				productId: LOOSE_PRODUCT,
				type: "IN",
				quantity: 1,
				unitPrice: "2500",
			});

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("unit_price_requires_exit");
	});

	it("answers 400 units_require_exit for an IN with unitIds", async () => {
		const testApp = setup();

		const response = await request(testApp.app)
			.post(`/companies/${COMPANY}/movements`)
			.set("authorization", authorization(OWNER_SUB))
			.send({
				productId: LOOSE_PRODUCT,
				type: "IN",
				quantity: 1,
				unitIds: [ROLL_A_UNIT],
			});

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("units_require_exit");
	});

	it.each([
		["a malformed unitPrice", { unitPrice: "12,50" }],
		["a zero unitPrice", { unitPrice: "0" }],
		["a unitPrice with three decimals", { unitPrice: "2500.123" }],
		["a malformed unit id", { unitIds: ["not-a-uuid"] }],
		["a repeated unit id", { unitIds: [ROLL_A_UNIT, ROLL_A_UNIT] }],
	])("answers 400 for %s on a sale", async (_label, overrides) => {
		const testApp = setup();

		const response = await sell(testApp, {
			productId: LOOSE_PRODUCT,
			type: "OUT",
			quantity: 1,
			...overrides,
		});

		expect(response.status).toBe(400);
		expect(response.body.error.issues.length).toBeGreaterThan(0);
	});
});
