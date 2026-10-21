import {
	array,
	nullable,
	number,
	object,
	picklist,
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
 * One product exactly as the products endpoints serialize it.
 *
 * `price` is a **decimal string** (`"1500.00"`), never a number: the column is
 * `Decimal(12,2)` and a float in the contract would lose precision at the first
 * rounding, so the boundary fails a numeric price instead of silently rounding
 * it. `stockQuantity` and `lowStockThreshold` are numbers because they are
 * counts; `description`, `photoUrl` and `categoryId` are nullable because a
 * product can live without them.
 */
export const productSchema = object({
	id: string(),
	companyId: string(),
	name: string(),
	description: nullable(string()),
	sku: string(),
	price: string(),
	photoUrl: nullable(string()),
	stockQuantity: number(),
	lowStockThreshold: number(),
	categoryId: nullable(string()),
	createdAt: string(),
	updatedAt: string(),
});

/** One product, derived from the OpenAPI contract. */
export type Product = components["schemas"]["Product"];

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
export const productsResponseSchema = array(productSchema);

/** `GET /companies/{companyId}/products` response, derived from the contract. */
export type ProductsResponse = components["schemas"]["Product"][];

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
 * The fields every movement carries, shared by the history and the creation
 * response.
 *
 * `type` is a closed list — the direction lives there, never in the sign of the
 * number — so an unknown value fails at the boundary instead of reaching the
 * badge. `quantity` is a **number** because it is a count, unlike the product's
 * decimal price. `reason` and `actor` are nullable: the reason is optional and a
 * user that cannot be resolved must never hide the movement, because the
 * movement is the audit trail of the stock (MOV-05).
 */
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
 * `type: "OUT"`, which is exactly what the API expects.
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
