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
