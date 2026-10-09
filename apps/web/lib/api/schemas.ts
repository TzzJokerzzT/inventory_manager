import { array, number, object, safeParse, string } from "valibot";
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
