import {
	array,
	nullable,
	number,
	object,
	picklist,
	pipe,
	regex,
	safeParse,
	string,
} from "valibot";
import { ApiError } from "./client";
import type { components } from "./openapi";

/**
 * Shape of `POST /auth/login` as the API promises it: the access token and its
 * lifetime. The refresh token is not here on purpose — it travels in an
 * `httpOnly` cookie the browser owns, out of reach of JavaScript.
 */
export const loginResponseSchema = object({
	accessToken: string(),
	expiresIn: number(),
});

/** `POST /auth/login` response, derived from the OpenAPI contract. */
export type LoginResponse = components["schemas"]["TokenResponse"];

const UNEXPECTED_RESPONSE =
	"El servidor devolvió una respuesta inesperada. Probá de nuevo.";

/**
 * Validates the response at the boundary instead of casting it.
 *
 * A backend that changes shape without warning has to fail as a data error with
 * a message a person can read, not explode later inside the UI. The error is an
 * {@link ApiError} so callers keep handling a single error type.
 */
export function parseLoginResponse(data: unknown): LoginResponse {
	const result = safeParse(loginResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Shape of one company exactly as `Company.toJSON()` serializes it in the API:
 * `{ id, name, createdAt }` with `createdAt` already an ISO string.
 */
export const companySchema = object({
	id: string(),
	name: string(),
	createdAt: string(),
});

/** One company, derived from the OpenAPI contract. */
export type Company = components["schemas"]["Company"];

/** Shape of `GET /companies`: the companies the authenticated user belongs to. */
export const companiesResponseSchema = array(companySchema);

/** `GET /companies` response, derived from the OpenAPI contract. */
export type CompaniesResponse = components["schemas"]["Company"][];

/**
 * Validates the companies response at the boundary.
 *
 * Same contract as {@link parseLoginResponse}: a backend that changes shape
 * fails as an {@link ApiError} with a readable message instead of exploding
 * inside a view.
 */
export function parseCompaniesResponse(data: unknown): CompaniesResponse {
	const result = safeParse(companiesResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Validates a single company, for the responses that return one (the creation).
 *
 * It exists so the created company goes through the same boundary as the listed
 * ones: a cast here would let a shape change reach the store unnoticed.
 */
export function parseCompany(data: unknown): Company {
	const result = safeParse(companySchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * One membership exactly as `GET`/`PATCH /me` serialize it: the company the
 * caller belongs to plus the role they hold in it.
 */
export const meMembershipSchema = object({
	companyId: string(),
	// A closed list, not a free string: the UI decides what to offer from the
	// role, so an unknown role has to fail here instead of reaching a view.
	role: picklist(["OWNER", "ADMIN", "MEMBER"]),
	company: companySchema,
});

/** One membership with its company, derived from the OpenAPI contract. */
export type MeMembership = components["schemas"]["MeMembership"];

/**
 * Shape of the caller's own identity as `GET`/`PATCH /me` serialize it:
 * `{ id, email, fullName, createdAt, memberships }`, with `fullName` nullable
 * because a user created by Auth0 starts without a display name.
 */
export const meResponseSchema = object({
	id: string(),
	email: string(),
	fullName: nullable(string()),
	createdAt: string(),
	memberships: array(meMembershipSchema),
});

/** `GET /me` and `PATCH /me` response, derived from the OpenAPI contract. */
export type MeResponse = components["schemas"]["MeResponse"];

/**
 * Validates the `/me` response at the boundary.
 *
 * Same contract as {@link parseLoginResponse}: a shape change fails as an
 * {@link ApiError} with a readable message, and the identity section feeds the
 * `fullName` gate that decides between the profile form and the company card.
 */
export function parseMeResponse(data: unknown): MeResponse {
	const result = safeParse(meResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * One membership exactly as the memberships endpoints serialize it.
 *
 * `userId` and `acceptedAt` are nullable because an unaccepted invitation has
 * no user yet; `role` and `status` are closed lists, not free strings, so an
 * unknown value fails here instead of reaching the permission selector (which
 * decides what the UI offers from those two values).
 */
export const membershipSchema = object({
	id: string(),
	userId: nullable(string()),
	invitedEmail: string(),
	companyId: string(),
	role: picklist(["OWNER", "ADMIN", "MEMBER"]),
	status: picklist(["INVITED", "ACTIVE", "REVOKED"]),
	invitedBy: string(),
	acceptedAt: nullable(string()),
	createdAt: string(),
	updatedAt: string(),
});

/** One membership of a company, derived from the OpenAPI contract. */
export type Membership = components["schemas"]["Membership"];

/**
 * Shape of the endpoints that answer a list of memberships:
 * `GET /companies/{companyId}/members` and `POST /me/invitations/accept`.
 */
export const membershipsResponseSchema = array(membershipSchema);

/** A list of memberships, derived from the OpenAPI contract. */
export type MembershipsResponse = components["schemas"]["Membership"][];

/**
 * Validates a membership list at the boundary (roster and accepted invitations).
 *
 * Same contract as {@link parseCompaniesResponse}: a backend that changes shape
 * fails as an {@link ApiError} with a readable message instead of exploding
 * inside the roster, and an unknown `role`/`status` never reaches the
 * permission selector.
 */
export function parseMembershipsResponse(data: unknown): MembershipsResponse {
	const result = safeParse(membershipsResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Validates a single membership, for the endpoints that answer one (invite,
 * role change and revoke).
 *
 * It exists so those responses go through the same boundary as the listed ones:
 * a cast here would let a shape change reach the roster unnoticed.
 */
export function parseMembership(data: unknown): Membership {
	const result = safeParse(membershipSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * A user as another member sees them — the inviter of a pending invitation or
 * the actor of a notification event — exactly as the API serializes it:
 * `{ id, fullName, email }`. One shape for both, matching the single
 * `UserSummary` in the contract, so the two cannot drift. `fullName` is
 * nullable because a user created by Auth0 starts without a display name; the
 * email is then the identifier the UI falls back to.
 */
export const userSummarySchema = object({
	id: string(),
	fullName: nullable(string()),
	email: string(),
});

/** One user summary, derived from the OpenAPI contract. */
export type UserSummary = components["schemas"]["UserSummary"];

/**
 * One pending invitation exactly as the API serializes it: the membership, the
 * role offered, when it was sent, the company and the inviter.
 *
 * `inviter` is nullable on purpose: a missing inviter must never hide the
 * invitation, so the boundary accepts `null` and the section falls back to a
 * neutral label instead of the parser rejecting the whole list.
 */
export const pendingInvitationSchema = object({
	membershipId: string(),
	companyId: string(),
	role: picklist(["OWNER", "ADMIN", "MEMBER"]),
	invitedAt: string(),
	company: companySchema,
	inviter: nullable(userSummarySchema),
});

/** One pending invitation, derived from the OpenAPI contract. */
export type PendingInvitation = components["schemas"]["PendingInvitation"];

/** Shape of `GET /me/invitations`: the caller's own pending invitations. */
export const pendingInvitationsResponseSchema = array(pendingInvitationSchema);

/** `GET /me/invitations` response, derived from the OpenAPI contract. */
export type PendingInvitationsResponse =
	components["schemas"]["PendingInvitation"][];

/**
 * Validates the pending invitations response at the boundary.
 *
 * Same contract as {@link parseCompaniesResponse}: a shape change fails as an
 * {@link ApiError} with a readable message instead of exploding inside the
 * profile section, and an unknown `role` never reaches the role label.
 */
export function parsePendingInvitations(
	data: unknown,
): PendingInvitationsResponse {
	const result = safeParse(pendingInvitationsResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * One notification event exactly as `GET /me/notifications` serializes it:
 * `{ id, type, createdAt, readAt, company, actor }`.
 *
 * `type` is a free string, not a picklist: the contract allows new event kinds
 * later, and the UI degrades unknown ones to neutral copy instead of failing
 * the whole list at the boundary. `readAt` is null while unread; `company` and
 * `actor` are null when they could not be resolved — the actor is also absent
 * on rows written before it was recorded — and a missing one never hides the
 * event, because the event is the fact.
 */
export const meNotificationSchema = object({
	id: string(),
	type: string(),
	createdAt: string(),
	readAt: nullable(string()),
	company: nullable(companySchema),
	actor: nullable(userSummarySchema),
});

/** One notification event, derived from the OpenAPI contract. */
export type MeNotification = components["schemas"]["MeNotification"];

/** Shape of `GET /me/notifications`: the caller's own events, newest first. */
export const notificationsResponseSchema = array(meNotificationSchema);

/** `GET /me/notifications` response, derived from the OpenAPI contract. */
export type NotificationsResponse = components["schemas"]["MeNotification"][];

/**
 * Validates the notifications response at the boundary.
 *
 * Same contract as {@link parsePendingInvitations}: a shape change fails as an
 * {@link ApiError} with a readable message instead of exploding inside the
 * profile section, and an unknown `type` is accepted on purpose so a new event
 * kind reaches the UI instead of breaking the read.
 */
export function parseNotifications(data: unknown): NotificationsResponse {
	const result = safeParse(notificationsResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * The measure units the contract allows, spelled out at the boundary (L19).
 *
 * A closed picklist, not a free string: the interface names the unit of every
 * `$ per measure` it shows, so an unknown value has to fail here instead of
 * reaching a label map that would have no name for it. It is the one place both
 * the catalogue and the supplier's last lot get it from.
 */
export const measureUnitSchema = picklist(["KILOGRAM", "LITRE", "METRE"]);

/** How a product's lots are measured, derived from the OpenAPI contract. */
export type MeasureUnit = components["schemas"]["MeasureUnit"];

/**
 * The fields every product response carries, shared by the catalogue row, the
 * detail and the write answers.
 */
const productFields = {
	id: string(),
	companyId: string(),
	name: string(),
	description: nullable(string()),
	sku: string(),
	price: string(),
	photoUrl: nullable(string()),
	stockQuantity: number(),
	lowStockThreshold: number(),
	measureUnit: measureUnitSchema,
	categoryId: nullable(string()),
	createdAt: string(),
	updatedAt: string(),
} as const;

/**
 * One product exactly as the products endpoints serialize it.
 *
 * `price` is a **decimal string** (`"1500.00"`), never a number: the column is
 * `Decimal(12,2)` and a float in the contract would lose precision at the first
 * rounding, so the boundary fails a numeric price instead of silently rounding
 * it. `stockQuantity` and `lowStockThreshold` are numbers because they are
 * counts; `description`, `photoUrl` and `categoryId` are nullable because a
 * product can live without them.
 *
 * `measureUnit` is how the lots of the product are measured, and it travels
 * with every read and write (L19): the list renders `$ 5.900,00 / kg` from this
 * value, never from an assumption about what the product is bought in.
 */
export const productSchema = object(productFields);

/** One product, derived from the OpenAPI contract. */
export type Product = components["schemas"]["Product"];

/**
 * One catalogue row: the product plus how many of its units are still
 * `AVAILABLE` (L25).
 *
 * It is the figure the sale screen reads to decide how a product is sold. It is
 * **optional** at the boundary because it arrived with the units read: a row
 * without it is read as "no units to offer", which is exactly what the sale did
 * before this field existed. It is not a silent loosening — the server still
 * refuses a loose sale of a unit-managed product with `400 units_required`, and
 * the form maps that code to Spanish — but it keeps a catalogue without the
 * counter usable instead of failing the whole list.
 *
 * Only this counter is validated of the derived `ProductCosts`: the costs and
 * the margin belong to the detail read, which asks for them when it needs them.
 */
export type ProductListItem = Product & { availableUnits: number };

/**
 * One catalogue row as the boundary validates it, derived from the contract's
 * `ProductListItem`. A counter of the wrong type is still a shape change and
 * fails here; only its absence is tolerated.
 */
export const productListItemSchema = object({
	...productFields,
	// Required, exactly like the contract: an absent counter is a shape change,
	// not "zero units". Reading it as zero would offer a loose sale that the
	// server then refuses with `units_required`.
	availableUnits: number(),
});

/** Body of `POST /companies/{companyId}/products`, derived from the contract. */
export type CreateProductRequest =
	components["schemas"]["CreateProductRequest"];

/**
 * Body of `PATCH /companies/{companyId}/products/{productId}`, derived from the
 * contract. Every field is optional on purpose: an absent field keeps its
 * value, while an explicit `null` clears `description` or `photoUrl`.
 */
export type UpdateProductRequest =
	components["schemas"]["UpdateProductRequest"];

/** Shape of `GET /companies/{companyId}/products`: the company's catalogue. */
export const productsResponseSchema = array(productListItemSchema);

/** `GET /companies/{companyId}/products` response, derived from the contract. */
export type ProductsResponse = ProductListItem[];

/**
 * Validates the catalogue at the boundary.
 *
 * Same contract as {@link parseCompaniesResponse}: a backend that changes shape
 * fails as an {@link ApiError} with a readable message instead of exploding
 * inside the table, and a numeric `price` never reaches the price formatter.
 */
export function parseProducts(data: unknown): ProductsResponse {
	const result = safeParse(productsResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Validates a single product: the detail read, the creation and the update.
 *
 * It exists so the product the form receives back goes through the same
 * boundary as the listed ones: a cast here would let a shape change reach a
 * view unnoticed.
 */
export function parseProduct(data: unknown): Product {
	const result = safeParse(productSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * One customer exactly as the customers endpoints serialize it.
 *
 * `email`, `phone` and `address` are nullable on purpose: they are optional
 * contact fields and the API stores an empty value as `null`. `createdAt` and
 * `updatedAt` are ISO strings, and a soft-deleted customer never reaches here —
 * the contract has no `deletedAt` field, and a deleted id answers `404`.
 */
export const customerSchema = object({
	id: string(),
	companyId: string(),
	name: string(),
	email: nullable(string()),
	phone: nullable(string()),
	address: nullable(string()),
	createdAt: string(),
	updatedAt: string(),
});

/** One customer, derived from the OpenAPI contract. */
export type Customer = components["schemas"]["Customer"];

/** Body of `POST /companies/{companyId}/customers`, derived from the contract. */
export type CreateCustomerRequest =
	components["schemas"]["CreateCustomerRequest"];

/**
 * Body of `PATCH /companies/{companyId}/customers/{customerId}`, derived from
 * the contract. Every field is optional on purpose: an absent field keeps its
 * value, while an explicit `null` clears `email`, `phone` or `address`.
 */
export type UpdateCustomerRequest =
	components["schemas"]["UpdateCustomerRequest"];

/**
 * Shape of `GET /companies/{companyId}/customers`: the company's customers,
 * already ordered by `name` and then `id` by the API, which is why the list is
 * shown in the order it arrives.
 */
export const customersResponseSchema = array(customerSchema);

/** `GET /companies/{companyId}/customers` response, derived from the contract. */
export type CustomersResponse = components["schemas"]["Customer"][];

/**
 * Validates the customer list at the boundary.
 *
 * Same contract as {@link parseProducts}: a backend that changes shape fails as
 * an {@link ApiError} with a readable message instead of exploding inside the
 * table, and a numeric phone never reaches a cell.
 */
export function parseCustomers(data: unknown): CustomersResponse {
	const result = safeParse(customersResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Validates a single customer: the detail read, the creation and the update.
 *
 * It exists so the customer the form receives back goes through the same
 * boundary as the listed ones: a cast here would let a shape change reach a
 * view unnoticed.
 */
export function parseCustomer(data: unknown): Customer {
	const result = safeParse(customerSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * The latest purchase lot of a supplier, as the roster summarizes it (L12):
 * which product it was, what one measure of it cost, the unit that measure is
 * expressed in, and when it arrived.
 *
 * `costPerMeasure` is a **decimal string** for the same reason as `price`:
 * money never travels as a float. `measureUnit` is a closed list, so an unknown
 * unit fails at the boundary instead of reaching the label that names it.
 */
export const supplierLastLotSchema = object({
	id: string(),
	productId: string(),
	// Resolved by the API, so a product soft-deleted afterwards still answers
	// what was bought instead of leaving a hole.
	productName: string(),
	costPerMeasure: string(),
	measureUnit: measureUnitSchema,
	receivedAt: string(),
});

/** The last lot of a supplier, derived from the OpenAPI contract. */
export type SupplierLastLot = components["schemas"]["SupplierLastLot"];

/**
 * The fields a supplier carries in every response, shared by the write answers
 * and the roster list.
 *
 * `contact` is nullable because it is free text (a person, a phone, an email or
 * all three) that the API stores as `null` when the box was left empty.
 */
const supplierFields = {
	id: string(),
	companyId: string(),
	name: string(),
	contact: nullable(string()),
	createdAt: string(),
	updatedAt: string(),
} as const;

/** One supplier exactly as the write endpoints serialize it. */
export const supplierSchema = object(supplierFields);

/** One supplier, derived from the OpenAPI contract. */
export type Supplier = components["schemas"]["Supplier"];

/**
 * One roster row: the stored supplier plus its latest lot.
 *
 * `lastLot` is **required and nullable**, never optional: `null` is the honest
 * "the company never bought from this supplier", while a missing key means the
 * backend changed shape and has to fail here instead of rendering a supplier
 * whose history silently disappeared.
 */
export const supplierListItemSchema = object({
	...supplierFields,
	lastLot: nullable(supplierLastLotSchema),
});

/** One roster row, derived from the OpenAPI contract. */
export type SupplierListItem = components["schemas"]["SupplierListItem"];

/** Body of `POST /companies/{companyId}/suppliers`, derived from the contract. */
export type CreateSupplierRequest =
	components["schemas"]["CreateSupplierRequest"];

/**
 * Body of `PATCH /companies/{companyId}/suppliers/{supplierId}`, derived from
 * the contract. Every field is optional on purpose: an absent field keeps its
 * value, while an explicit `null` clears `contact`.
 */
export type UpdateSupplierRequest =
	components["schemas"]["UpdateSupplierRequest"];

/**
 * Shape of `GET /companies/{companyId}/suppliers`: the company's roster, already
 * ordered by `name` and then `id` by the API, which is why it is shown in the
 * order it arrives.
 */
export const supplierListSchema = array(supplierListItemSchema);

/** `GET /companies/{companyId}/suppliers` response, derived from the contract. */
export type SuppliersResponse = components["schemas"]["SupplierListItem"][];

/**
 * Validates the roster at the boundary.
 *
 * Same contract as {@link parseCustomers}: a backend that changes shape fails as
 * an {@link ApiError} with a readable message instead of exploding inside the
 * table, and a `costPerMeasure` that is not a decimal string never reaches the
 * price formatter.
 */
export function parseSuppliers(data: unknown): SuppliersResponse {
	const result = safeParse(supplierListSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Validates a single supplier: the creation and the update answers.
 *
 * It exists so the supplier the form receives back goes through the same
 * boundary as the listed ones: a cast here would let a shape change reach a
 * view unnoticed.
 */
export function parseSupplier(data: unknown): Supplier {
	const result = safeParse(supplierSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * One physical unit of a lot, exactly as the lot endpoints serialize it: its
 * code (generated from the position), its own `measure` and therefore its own
 * `cost`.
 *
 * Both numbers are **decimal strings**, never numbers: they are weight and
 * money, and the column keeps three and two decimals respectively. `status` is
 * a closed list — a unit is available until a sale takes it (S2) — so an unknown
 * value fails here instead of reaching a badge with no label for it.
 */
export const lotUnitSchema = object({
	id: string(),
	code: string(),
	measure: string(),
	cost: string(),
	status: picklist(["AVAILABLE", "SOLD"]),
});

/** One unit of a purchase lot, derived from the OpenAPI contract. */
export type StockLotUnit = components["schemas"]["StockLotUnit"];

/**
 * One purchase lot as `POST /companies/{companyId}/lots` answers it (S6): the
 * supplier, the price of one measure, the number of physical units and every
 * unit with its own measure and cost.
 *
 * `measureTotal` is what the **server derived** from the units and is kept as a
 * decimal string; the client never sends it and never recomputes it (L6). The
 * unit list is required and non-optional: an absent one means the backend
 * changed shape, and the purchase cannot be shown without its detail.
 */
export const lotSchema = object({
	id: string(),
	companyId: string(),
	productId: string(),
	supplierId: string(),
	receivedAt: string(),
	measureTotal: string(),
	costPerMeasure: string(),
	unitCount: number(),
	note: nullable(string()),
	createdAt: string(),
	units: array(lotUnitSchema),
});

/** One purchase lot, derived from the OpenAPI contract. */
export type StockLot = components["schemas"]["StockLot"];

/** Body of `POST /companies/{companyId}/lots`, derived from the contract. */
export type CreateLotRequest = components["schemas"]["CreateLotRequest"];

/**
 * Validates the lot of a registered purchase at the boundary.
 *
 * Same contract as {@link parseSupplier}: a shape change fails as an
 * {@link ApiError} with a readable message instead of reaching the success
 * notice, and a numeric `measure` never gets formatted as weight.
 */
export function parseLot(data: unknown): StockLot {
	const result = safeParse(lotSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * One physical unit of a product as `GET /products/{id}/units` answers it
 * (L23): which unit it is, how much it measures, what it cost and where it came
 * from.
 *
 * `measure` and `cost` are **decimal strings**, never numbers, for the same
 * reason as the lot's: they are weight and money. `status` is a closed list — a
 * unit is available until a sale takes it (S2) — so an unknown value fails here
 * instead of reaching a checkbox the person could tick for a unit that already
 * left. `lotId` and `receivedAt` are kept because they are what orders the list
 * (oldest stock first) and what a sale would refer back to.
 */
export const productUnitSchema = object({
	id: string(),
	code: string(),
	measure: string(),
	cost: string(),
	status: picklist(["AVAILABLE", "SOLD"]),
	lotId: string(),
	receivedAt: string(),
});

/** One unit of a product, derived from the OpenAPI contract. */
export type ProductUnit = components["schemas"]["ProductUnit"];

/**
 * Shape of `GET /companies/{companyId}/products/{productId}/units`: the units
 * of one product, oldest lot first and then by code, as the API orders them.
 */
export const productUnitsResponseSchema = array(productUnitSchema);

/** `GET .../products/{productId}/units` response, derived from the contract. */
export type ProductUnitsResponse = ProductUnit[];

/**
 * Validates the units of a product at the boundary.
 *
 * Same contract as {@link parseLot}: a shape change fails as an {@link ApiError}
 * with a readable message instead of reaching the sale list, and a numeric
 * `measure` never gets formatted as a weight. An empty list is valid and means
 * "this product has no units in the requested status".
 */
export function parseProductUnits(data: unknown): ProductUnitsResponse {
	const result = safeParse(productUnitsResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * The upload contract `POST /companies/{companyId}/media/signature` returns:
 * the Cloudinary coordinates plus the limits the server already signed into
 * the signature. The browser validates the file against **these** values, not
 * against its own constants, so a server-side change of formats or size limit
 * moves the client with it.
 */
export const mediaUploadSignatureSchema = object({
	cloudName: string(),
	apiKey: string(),
	timestamp: number(),
	signature: string(),
	folder: string(),
	allowedFormats: array(string()),
	maxFileSizeBytes: number(),
});

/** Signed upload parameters, derived from the OpenAPI contract. */
export type MediaUploadSignature =
	components["schemas"]["MediaUploadSignature"];

/**
 * The product a movement refers to, as the history shows it.
 *
 * It is a reduced copy on purpose: the movement is immutable, so the name and the
 * SKU are the ones the product had when the stock moved, not a live join.
 */
export const movementProductSchema = object({
	id: string(),
	name: string(),
	sku: string(),
});

/** The product of a movement, derived from the OpenAPI contract. */
export type MovementProduct = components["schemas"]["MovementProduct"];

/**
 * The customer a sale is associated with, as the history shows it.
 *
 * A reduced copy like {@link movementProductSchema}, and for the same reason: the
 * movement is the audit trail of the stock (MOV-05), so a customer soft-deleted
 * after the sale still shows the name the ledger recorded, instead of the row
 * turning into a hole.
 */
export const movementCustomerSchema = object({
	id: string(),
	name: string(),
});

/** The customer of a movement, derived from the OpenAPI contract. */
export type MovementCustomer = components["schemas"]["MovementCustomer"];

/**
 * The fields every movement carries, shared by the history and the creation
 * response.
 *
 * `type` is a closed list — the direction lives there, never in the sign of the
 * number — so an unknown value fails at the boundary instead of reaching the
 * badge. `quantity` is a **number** because it is a count, unlike the product's
 * decimal price. `reason` and `actor` are nullable: the reason is optional and a
 * user that cannot be resolved must never hide the movement, because the
 * movement is the audit trail of the stock (MOV-05).
 *
 * `customerId` and `customer` are both required and nullable (MI-10): the API
 * resolves the customer on the server, so `customer` is `null` exactly when the
 * movement has no association — an entry, or a sale without an identified
 * customer — and the table never reads `customerId` to decide what to show.
 */
/**
 * One physical unit a sale took, as `GET /movements` serializes it.
 *
 * `measure` and `cost` are **decimal strings**, not numbers: they are money and
 * weight, and the API sends them as strings so no cent is lost in a float.
 */
export const movementUnitSchema = object({
	id: string(),
	code: string(),
	// Validated as strings, never numbers, for the same reason as `price`.
	measure: string(),
	cost: string(),
});

const movementFields = {
	id: string(),
	companyId: string(),
	productId: string(),
	type: picklist(["IN", "OUT"]),
	quantity: number(),
	reason: nullable(string()),
	createdAt: string(),
	product: movementProductSchema,
	actor: nullable(userSummarySchema),
	customerId: nullable(string()),
	customer: nullable(movementCustomerSchema),
	// Added with the purchase-lot feature. They are validated here like every
	// other contract field even though the UI does not render them yet: the
	// boundary either understands the response or fails loudly, and a movement
	// parsed without its price would silently lose the sale's money.
	lotId: nullable(string()),
	unitPrice: nullable(string()),
	units: array(movementUnitSchema),
	// Server-computed: `unitPrice × quantity − Σ units.cost`, or `null` when the
	// price or the units are unknown (a sale from before the lot feature). The
	// front never recomputes it: money is not a place for client arithmetic.
	margin: nullable(string()),
} as const;

/** One stock movement exactly as the movements endpoints serialize it. */
export const stockMovementSchema = object(movementFields);

/** One stock movement, derived from the OpenAPI contract. */
export type StockMovement = components["schemas"]["StockMovement"];

/** Shape of `GET /companies/{companyId}/movements`: newest first. */
export const movementsResponseSchema = array(stockMovementSchema);

/** `GET /companies/{companyId}/movements` response, derived from the contract. */
export type MovementsResponse = components["schemas"]["StockMovement"][];

/**
 * Body of `POST /companies/{companyId}/movements`, derived from the contract.
 *
 * The direction is a field, not a sign: an exit sends `quantity` positive with
 * `type: "OUT"`, which is exactly what the API expects. `customerId` is optional
 * and only meaningful on an exit (MI-10): an entry that carries a customer
 * answers `400 customer_requires_exit`, so nothing builds one for `IN`.
 */
export type RegisterMovementRequest =
	components["schemas"]["RegisterMovementRequest"];

/**
 * The creation response: the recorded movement plus the product's stock after
 * it. The stock is the server's number, so the UI shows it instead of computing
 * `previous + quantity` from a cache it cannot trust.
 */
export const registerMovementResponseSchema = object({
	...movementFields,
	stockQuantity: number(),
});

/** `POST /companies/{companyId}/movements` response, derived from the contract. */
export type RegisterMovementResponse =
	components["schemas"]["RegisterMovementResponse"];

/**
 * Validates the history at the boundary.
 *
 * Same contract as {@link parseProducts}: a backend that changes shape fails as
 * an {@link ApiError} with a readable message instead of exploding inside the
 * movements table, and a `quantity` that is not a number never reaches the
 * formatter.
 */
export function parseMovements(data: unknown): MovementsResponse {
	const result = safeParse(movementsResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Validates the creation response, which is a movement plus the resulting stock.
 *
 * The stock is what the person sees on success, so a response without it must
 * fail here rather than in the UI.
 */
export function parseRegisterMovementResponse(
	data: unknown,
): RegisterMovementResponse {
	const result = safeParse(registerMovementResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * One point of the movement trend: a **UTC day** and what entered and left the
 * stock that day.
 *
 * `date` is validated against the `Format: date` the contract declares instead of
 * accepting any string: the aggregate is per day, so a full timestamp or a local
 * date is a shape change, not a value the chart could place on its axis. The
 * counters are **numbers** because they are sums of quantities, not money.
 */
export const movementTrendPointSchema = object({
	date: pipe(string(), regex(/^\d{4}-\d{2}-\d{2}$/)),
	entries: number(),
	exits: number(),
});

/** One day of the movement trend, derived from the OpenAPI contract. */
export type MovementTrendPoint = components["schemas"]["MovementTrendPoint"];

/**
 * Shape of `GET /companies/{companyId}/reports/movements`: the window the server
 * aggregated plus one point per day, **oldest first** and already zero-filled by
 * the server for the days without movements. The client draws them in the order
 * it receives them and never re-sorts or re-fills.
 */
export const movementTrendResponseSchema = object({
	days: number(),
	series: array(movementTrendPointSchema),
});

/** `GET /companies/{companyId}/reports/movements` response, derived from the contract. */
export type MovementTrendResponse =
	components["schemas"]["MovementTrendResponse"];

/**
 * Validates the trend report at the boundary.
 *
 * Same contract as {@link parseMovements}: a backend that changes shape fails as
 * an {@link ApiError} with a readable message instead of exploding inside the
 * chart, and a missing series never turns into a period the server did not
 * compute.
 */
export function parseMovementTrend(data: unknown): MovementTrendResponse {
	const result = safeParse(movementTrendResponseSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}

/**
 * Validates the signature before a byte is uploaded.
 *
 * A signature with a changed shape would otherwise produce a request the
 * storage provider rejects with an opaque error, far from its cause.
 */
export function parseMediaUploadSignature(data: unknown): MediaUploadSignature {
	const result = safeParse(mediaUploadSignatureSchema, data);
	if (!result.success) {
		throw new ApiError(UNEXPECTED_RESPONSE);
	}

	return result.output;
}
