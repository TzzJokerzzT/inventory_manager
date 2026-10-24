import type { Supplier } from "../../domain/entities/supplier.js";
import type { SupplierRepository } from "../../domain/repositories/supplier-repository.js";

export interface ListSuppliersContext {
	/** The company whose suppliers are being read. */
	companyId: string;
}

export interface ListSuppliersDependencies {
	supplierRepository: SupplierRepository;
}

/**
 * Use case for listing a company's suppliers (S4).
 *
 * Reading needs **no role**: the company context already proved an ACTIVE
 * membership, and `manage_products` only discriminates on writes (OWNER and
 * ADMIN write, MEMBER reads). The scoping is the `companyId` in the query, not
 * a filter here, so a caller can only ever see the suppliers of a company they
 * belong to.
 *
 * Ordering (`name`, then `id`) belongs to the adapter, so both adapters answer
 * the same array for the same state.
 */
export class ListSuppliersUseCase {
	private readonly supplierRepository: SupplierRepository;

	constructor(dependencies: ListSuppliersDependencies) {
		this.supplierRepository = dependencies.supplierRepository;
	}

	async execute(context: ListSuppliersContext): Promise<Supplier[]> {
		return this.supplierRepository.listByCompany(context.companyId);
	}
}
