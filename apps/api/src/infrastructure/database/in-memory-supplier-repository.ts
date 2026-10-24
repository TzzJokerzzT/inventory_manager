import { Supplier } from "../../domain/entities/supplier.js";
import { SupplierNameAlreadyExistsError } from "../../domain/errors/supplier-name-already-exists-error.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";

/**
 * In-memory adapter for the {@link SupplierRepository} port.
 *
 * It mirrors the Prisma adapter's rules -- `deletedAt: null` on every active
 * read, company scoping inside the query, the same deterministic order and the
 * same name uniqueness (deleted rows included) -- so the two stay
 * interchangeable behind the port.
 *
 * The uniqueness check is the one place the two adapters must not share code:
 * here it is an explicit comparison over the rows, because there is no unique
 * index to lean on. Both answers are the same
 * {@link SupplierNameAlreadyExistsError}, so no use case can tell which store
 * answered.
 */
export class InMemorySupplierRepository implements SupplierRepository {
	private readonly suppliers: Map<string, Supplier>;

	constructor(suppliers: Supplier[] = []) {
		this.suppliers = new Map<string, Supplier>();

		for (const supplier of suppliers) {
			this.suppliers.set(supplier.id, supplier);
		}
	}

	async create(supplier: Supplier): Promise<Supplier> {
		// The unique index covers the soft-deleted rows too, so a deleted
		// supplier keeps its name reserved. Comparing the raw strings is
		// exactly what the index does (case-sensitive), never a lowercased
		// comparison.
		if (this.isNameTaken(supplier.companyId, supplier.name, supplier.id)) {
			throw new SupplierNameAlreadyExistsError();
		}

		this.suppliers.set(supplier.id, supplier);

		return supplier;
	}

	async findById(
		companyId: string,
		supplierId: string,
	): Promise<Supplier | null> {
		const supplier = this.suppliers.get(supplierId);

		// Same two conditions the Prisma adapter puts in the WHERE clause: the
		// company and the soft-delete stamp are part of the query, so a
		// soft-deleted supplier and a foreign one answer the same `null`.
		if (
			supplier === undefined ||
			supplier.companyId !== companyId ||
			supplier.deletedAt !== null
		) {
			return null;
		}

		return supplier;
	}

	async listByCompany(companyId: string): Promise<Supplier[]> {
		return Array.from(this.suppliers.values())
			.filter((row) => row.companyId === companyId && row.deletedAt === null)
			.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
	}

	async update(supplier: Supplier): Promise<Supplier | null> {
		const existing = this.suppliers.get(supplier.id);

		// The guarded write: an absent, foreign or already-deleted row is not
		// updated, exactly like `where: { ..., deletedAt: null }`.
		if (
			existing === undefined ||
			existing.companyId !== supplier.companyId ||
			existing.deletedAt !== null
		) {
			return null;
		}

		// The row itself is excluded from the collision check, so keeping its own
		// name (or changing only the contact) is never a conflict.
		if (this.isNameTaken(supplier.companyId, supplier.name, supplier.id)) {
			throw new SupplierNameAlreadyExistsError();
		}

		// The entity is immutable, so the update replaces the row under the same
		// id.
		this.suppliers.set(supplier.id, supplier);

		return supplier;
	}

	async softDelete(
		companyId: string,
		supplierId: string,
		deletedAt: Date,
	): Promise<Supplier | null> {
		const existing = this.suppliers.get(supplierId);

		if (
			existing === undefined ||
			existing.companyId !== companyId ||
			existing.deletedAt !== null
		) {
			return null;
		}

		const deleted = Supplier.create({
			id: existing.id,
			companyId: existing.companyId,
			name: existing.name,
			contact: existing.contact,
			deletedAt,
			createdAt: existing.createdAt,
			updatedAt: deletedAt,
		});

		// The row stays: the purchase lots of S6 must keep pointing at a readable
		// supplier, and its name stays reserved until the row is gone.
		this.suppliers.set(deleted.id, deleted);

		return deleted;
	}

	/** Adapter-specific: lets the test suite insert suppliers directly. */
	save(supplier: Supplier): void {
		this.suppliers.set(supplier.id, supplier);
	}

	/**
	 * The uniqueness rule of `@@unique([companyId, name])`, in memory: any row
	 * of the company with the same exact name collides, deleted or not, and the
	 * row being written never collides with itself.
	 */
	private isNameTaken(
		companyId: string,
		name: string,
		ignoredId: string,
	): boolean {
		for (const row of this.suppliers.values()) {
			if (
				row.id !== ignoredId &&
				row.companyId === companyId &&
				row.name === name
			) {
				return true;
			}
		}

		return false;
	}
}
