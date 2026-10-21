import type { Customer } from "../entities/customer.js";

/**
 * Port for customer persistence.
 *
 * Two things are part of the contract rather than an optimisation:
 *
 * - **Every query takes the `companyId` and filters by it in the WHERE
 *   clause** (isolation, EMP-03/S5). A read that resolved a row and compared
 *   the company afterwards would be a filter in memory, and the adapter could
 *   forget it.
 * - **`deletedAt` is a guard, never a post-filter.** A soft-deleted customer is
 *   simply not there: `findActiveById`, `list` and both writes only ever see
 *   active rows, so "deleted" and "does not exist" are the same answer.
 *
 * There is no email lookup: the roster has no uniqueness rule, so no read needs
 * to answer "does this email exist already".
 */
export interface CustomerRepository {
	/**
	 * Persists a customer that already exists as an entity, so it reaches the
	 * database already validated and normalized (trimmed name, lowercased
	 * email, blank contact fields as `null`).
	 */
	create(customer: Customer): Promise<Customer>;

	/** Resolves an active customer of the company, or `null`. */
	findActiveById(
		companyId: string,
		customerId: string,
	): Promise<Customer | null>;

	/**
	 * Resolves the customers of the company with the given ids in one batch
	 * read.
	 *
	 * It is a **history** read, which is why it differs from
	 * {@link findActiveById}: a stock movement of a customer that was later
	 * soft-deleted must stay readable (MOV-05, CLI-04), so the `deletedAt`
	 * filter is deliberately absent. The `companyId` stays in the WHERE clause,
	 * so a deleted customer of another company never resolves. The result is
	 * not required to be complete or ordered -- an id with no row is simply
	 * absent -- so the caller joins in memory; for the movement history a
	 * missing customer is an inconsistent store, never an invented row.
	 */
	findByIds(companyId: string, ids: string[]): Promise<Customer[]>;

	/**
	 * Lists the company's active customers, ordered by name and then id so two
	 * reads of the same state answer the same array.
	 *
	 * `search`, when present, is a case-insensitive substring matched against
	 * the name **or** the email **or** the phone (CLI-05/S4).
	 */
	list(companyId: string, search?: string): Promise<Customer[]>;

	/**
	 * Writes the next state of an already-valid entity, guarded on
	 * `deletedAt: null`, and returns the stored row -- or `null` when nothing
	 * was updated (the customer was soft-deleted or belongs to another company
	 * between the read and the write).
	 */
	update(customer: Customer): Promise<Customer | null>;

	/**
	 * Soft-deletes an active customer by stamping `deletedAt`, and returns the
	 * row -- or `null` when there was nothing to delete.
	 *
	 * The stamp is a parameter so both adapters store the exact instant the use
	 * case decided on, instead of each adapter inventing its own clock.
	 *
	 * Guarded on `deletedAt: null` so a second `DELETE` is a `null` instead of a
	 * second stamp that would reset the original date.
	 */
	softDelete(
		companyId: string,
		customerId: string,
		deletedAt: Date,
	): Promise<Customer | null>;
}
