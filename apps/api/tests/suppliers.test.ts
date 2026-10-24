import { CreateSupplierUseCase } from "../src/application/use-cases/create-supplier.js";
import { DeleteSupplierUseCase } from "../src/application/use-cases/delete-supplier.js";
import { ListSuppliersUseCase } from "../src/application/use-cases/list-suppliers.js";
import { UpdateSupplierUseCase } from "../src/application/use-cases/update-supplier.js";
import type { MembershipRole } from "../src/domain/entities/membership.js";
import { Supplier } from "../src/domain/entities/supplier.js";
import { DomainError } from "../src/domain/errors/domain-error.js";
import { InsufficientRoleError } from "../src/domain/errors/insufficient-role-error.js";
import { SupplierNameAlreadyExistsError } from "../src/domain/errors/supplier-name-already-exists-error.js";
import { SupplierNotFoundError } from "../src/domain/errors/supplier-not-found-error.js";
import { InMemoryProductRepository } from "../src/infrastructure/database/in-memory-product-repository.js";
import { InMemoryStockLotRepository } from "../src/infrastructure/database/in-memory-stock-lot-repository.js";
import { InMemoryStockMovementRepository } from "../src/infrastructure/database/in-memory-stock-movement-repository.js";
import { InMemorySupplierRepository } from "../src/infrastructure/database/in-memory-supplier-repository.js";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";

interface SeedInput {
	id: string;
	companyId?: string;
	name?: string;
	contact?: string | null;
	deleted?: boolean;
}

function seed(
	repository: InMemorySupplierRepository,
	input: SeedInput,
): Supplier {
	const supplier = Supplier.create({
		id: input.id,
		companyId: input.companyId ?? COMPANY,
		name: input.name ?? `Supplier ${input.id}`,
		contact: input.contact ?? null,
		deletedAt: input.deleted ? new Date("2026-10-22T12:00:00.000Z") : null,
	});

	repository.save(supplier);

	return supplier;
}

function repository(): InMemorySupplierRepository {
	return new InMemorySupplierRepository();
}

/**
 * The roster read resolves each supplier's latest lot, so it needs the three
 * stores even when a suite seeds no lot at all.
 */
function listSuppliers(repository_: InMemorySupplierRepository) {
	return new ListSuppliersUseCase({
		supplierRepository: repository_,
		stockLotRepository: new InMemoryStockLotRepository(
			new InMemoryStockMovementRepository(new Map()),
		),
		productRepository: new InMemoryProductRepository(),
	});
}

function context(actorRole: MembershipRole = "OWNER") {
	return { companyId: COMPANY, actorRole };
}

describe("CreateSupplierUseCase", () => {
	function createSupplier(repository_: InMemorySupplierRepository) {
		return new CreateSupplierUseCase({ supplierRepository: repository_ });
	}

	it.each<MembershipRole>(["OWNER", "ADMIN"])(
		"creates the supplier as a %s, because writing is `manage_products`",
		async (actorRole) => {
			const created = await createSupplier(repository()).execute(
				{ name: "  Distribuidora Sur  ", contact: "  Juan Perez  " },
				context(actorRole),
			);

			expect(created).toMatchObject({
				companyId: COMPANY,
				name: "Distribuidora Sur",
				contact: "Juan Perez",
			});
		},
	);

	it("rejects a MEMBER and stores nothing", async () => {
		// S6: MEMBER reads the catalogue, and the supplier ABM is a write.
		const repository_ = repository();

		await expect(
			createSupplier(repository_).execute(
				{ name: "Distribuidora Sur" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
		await expect(repository_.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("persists the supplier it returns", async () => {
		const repository_ = repository();

		const created = await createSupplier(repository_).execute(
			{ name: "Distribuidora Sur" },
			context(),
		);

		await expect(repository_.findById(COMPANY, created.id)).resolves.toBe(
			created,
		);
	});

	it("stores a supplier without contact as null", async () => {
		const created = await createSupplier(repository()).execute(
			{ name: "Distribuidora Sur", contact: "   " },
			context(),
		);

		expect(created.contact).toBeNull();
	});

	it("rejects an invalid name before anything is stored", async () => {
		const repository_ = repository();

		await expect(
			createSupplier(repository_).execute({ name: "   " }, context()),
		).rejects.toThrow(DomainError);
		await expect(repository_.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("rejects a duplicated name in the same company and keeps only the first", async () => {
		const repository_ = repository();
		const useCase = createSupplier(repository_);

		await useCase.execute({ name: "Distribuidora Sur" }, context());

		await expect(
			useCase.execute({ name: "Distribuidora Sur" }, context()),
		).rejects.toThrow(SupplierNameAlreadyExistsError);
		await expect(repository_.listByCompany(COMPANY)).resolves.toHaveLength(1);
	});

	it("answers the same for a name held by a soft-deleted supplier", async () => {
		// The `@@unique([companyId, name])` index covers the deleted rows, so
		// deleting a supplier reserves its name.
		const repository_ = repository();
		seed(repository_, { id: "supplier-1", name: "Distribuidora Sur" });
		const useCase = createSupplier(repository_);

		await new DeleteSupplierUseCase({
			supplierRepository: repository_,
		}).execute({ supplierId: "supplier-1" }, context());

		await expect(
			useCase.execute({ name: "Distribuidora Sur" }, context()),
		).rejects.toThrow(SupplierNameAlreadyExistsError);
	});

	it("accepts the same name in another company", async () => {
		const repository_ = repository();
		const useCase = createSupplier(repository_);

		await useCase.execute({ name: "Distribuidora Sur" }, context());
		const other = await useCase.execute(
			{ name: "Distribuidora Sur" },
			{ companyId: OTHER_COMPANY, actorRole: "OWNER" },
		);

		expect(other.companyId).toBe(OTHER_COMPANY);
	});
});

describe("ListSuppliersUseCase", () => {
	it("lists the company's active suppliers ordered by name and then id", async () => {
		const repository_ = repository();
		seed(repository_, { id: "supplier-z", name: "Zeta" });
		seed(repository_, { id: "supplier-a", name: "Alfa" });
		seed(repository_, { id: "supplier-m", name: "Alfa" });

		const suppliers = await listSuppliers(repository_).execute({
			companyId: COMPANY,
		});

		expect(suppliers.map((supplier) => supplier.id)).toEqual([
			"supplier-a",
			"supplier-m",
			"supplier-z",
		]);
	});

	it("never lists a soft-deleted supplier nor another company's", async () => {
		const repository_ = repository();
		seed(repository_, { id: "supplier-1", name: "Propio" });
		seed(repository_, { id: "supplier-2", name: "Borrado", deleted: true });
		seed(repository_, {
			id: "supplier-3",
			name: "Ajeno",
			companyId: OTHER_COMPANY,
		});

		const suppliers = await listSuppliers(repository_).execute({
			companyId: COMPANY,
		});

		expect(suppliers.map((supplier) => supplier.name)).toEqual(["Propio"]);
	});

	it("answers an empty array for a company without suppliers", async () => {
		await expect(
			listSuppliers(repository()).execute({ companyId: COMPANY }),
		).resolves.toEqual([]);
	});
});

describe("UpdateSupplierUseCase", () => {
	function updateSupplier(repository_: InMemorySupplierRepository) {
		return new UpdateSupplierUseCase({ supplierRepository: repository_ });
	}

	it("updates only the given fields", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "supplier-1",
			name: "Distribuidora Sur",
			contact: "Juan Perez",
		});

		const updated = await updateSupplier(repository_).execute(
			{ supplierId: "supplier-1", name: "  Distribuidora Norte  " },
			context(),
		);

		expect(updated.name).toBe("Distribuidora Norte");
		expect(updated.contact).toBe("Juan Perez");
		await expect(repository_.findById(COMPANY, "supplier-1")).resolves.toBe(
			updated,
		);
	});

	it.each([
		["null", null],
		["the empty string", ""],
	])("clears the contact with %s", async (_label, contact) => {
		const repository_ = repository();
		seed(repository_, {
			id: "supplier-1",
			name: "Distribuidora Sur",
			contact: "Juan Perez",
		});

		const updated = await updateSupplier(repository_).execute(
			{ supplierId: "supplier-1", contact },
			context(),
		);

		expect(updated.contact).toBeNull();
	});

	it("rejects a MEMBER and leaves the stored row untouched", async () => {
		const repository_ = repository();
		const stored = seed(repository_, {
			id: "supplier-1",
			name: "Distribuidora Sur",
			contact: "Juan Perez",
		});

		await expect(
			updateSupplier(repository_).execute(
				{ supplierId: "supplier-1", name: "Otra" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
		await expect(repository_.findById(COMPANY, "supplier-1")).resolves.toBe(
			stored,
		);
	});

	it("rejects an absent supplier without writing anything", async () => {
		const repository_ = repository();

		await expect(
			updateSupplier(repository_).execute(
				{ supplierId: "supplier-1", name: "Otra" },
				context(),
			),
		).rejects.toThrow(SupplierNotFoundError);
		await expect(repository_.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("rejects a soft-deleted supplier", async () => {
		const repository_ = repository();
		seed(repository_, {
			id: "supplier-1",
			name: "Distribuidora Sur",
			deleted: true,
		});

		await expect(
			updateSupplier(repository_).execute(
				{ supplierId: "supplier-1", name: "Otra" },
				context(),
			),
		).rejects.toThrow(SupplierNotFoundError);
	});

	it("rejects another company's supplier and leaves it untouched", async () => {
		const repository_ = repository();
		const foreign = seed(repository_, {
			id: "supplier-1",
			name: "Ajeno",
			companyId: OTHER_COMPANY,
		});

		await expect(
			updateSupplier(repository_).execute(
				{ supplierId: "supplier-1", name: "Otra" },
				context(),
			),
		).rejects.toThrow(SupplierNotFoundError);
		await expect(
			repository_.findById(OTHER_COMPANY, "supplier-1"),
		).resolves.toBe(foreign);
	});

	it("rejects a rename onto a name the company already uses and keeps the old name", async () => {
		const repository_ = repository();
		seed(repository_, { id: "supplier-1", name: "Distribuidora Sur" });
		seed(repository_, { id: "supplier-2", name: "Distribuidora Norte" });

		await expect(
			updateSupplier(repository_).execute(
				{ supplierId: "supplier-2", name: "Distribuidora Sur" },
				context(),
			),
		).rejects.toThrow(SupplierNameAlreadyExistsError);
		await expect(
			repository_.findById(COMPANY, "supplier-2"),
		).resolves.toMatchObject({ name: "Distribuidora Norte" });
	});

	it("accepts keeping its own name", async () => {
		const repository_ = repository();
		seed(repository_, { id: "supplier-1", name: "Distribuidora Sur" });

		const updated = await updateSupplier(repository_).execute(
			{ supplierId: "supplier-1", name: "Distribuidora Sur", contact: "Juan" },
			context(),
		);

		expect(updated).toMatchObject({
			name: "Distribuidora Sur",
			contact: "Juan",
		});
	});
});

describe("DeleteSupplierUseCase", () => {
	function deleteSupplier(repository_: InMemorySupplierRepository) {
		return new DeleteSupplierUseCase({ supplierRepository: repository_ });
	}

	it("stamps deletedAt, so the supplier leaves every active read", async () => {
		const repository_ = repository();
		seed(repository_, { id: "supplier-1", name: "Distribuidora Sur" });

		await deleteSupplier(repository_).execute(
			{ supplierId: "supplier-1" },
			context(),
		);

		await expect(
			repository_.findById(COMPANY, "supplier-1"),
		).resolves.toBeNull();
		await expect(repository_.listByCompany(COMPANY)).resolves.toEqual([]);
	});

	it("answers a second delete with the same not-found error", async () => {
		const repository_ = repository();
		seed(repository_, { id: "supplier-1", name: "Distribuidora Sur" });
		const useCase = deleteSupplier(repository_);

		await useCase.execute({ supplierId: "supplier-1" }, context());

		await expect(
			useCase.execute({ supplierId: "supplier-1" }, context()),
		).rejects.toThrow(SupplierNotFoundError);
	});

	it("answers an absent or foreign supplier with the same not-found error", async () => {
		const repository_ = repository();
		const foreign = seed(repository_, {
			id: "supplier-1",
			name: "Ajeno",
			companyId: OTHER_COMPANY,
		});
		const useCase = deleteSupplier(repository_);

		await expect(
			useCase.execute({ supplierId: "supplier-404" }, context()),
		).rejects.toThrow(SupplierNotFoundError);
		await expect(
			useCase.execute({ supplierId: "supplier-1" }, context()),
		).rejects.toThrow(SupplierNotFoundError);
		await expect(
			repository_.findById(OTHER_COMPANY, "supplier-1"),
		).resolves.toBe(foreign);
	});

	it("rejects a MEMBER and leaves the row active", async () => {
		const repository_ = repository();
		const stored = seed(repository_, {
			id: "supplier-1",
			name: "Distribuidora Sur",
		});

		await expect(
			deleteSupplier(repository_).execute(
				{ supplierId: "supplier-1" },
				context("MEMBER"),
			),
		).rejects.toThrow(InsufficientRoleError);
		await expect(repository_.findById(COMPANY, "supplier-1")).resolves.toBe(
			stored,
		);
	});
});
