import {
	array,
	type InferOutput,
	number,
	object,
	safeParse,
	string,
} from "valibot";
import { ApiError } from "./client";

/**
 * Shape of `POST /auth/login` as the API promises it: the access token and its
 * lifetime. The refresh token is not here on purpose — it travels in an
 * `httpOnly` cookie the browser owns, out of reach of JavaScript.
 */
export const loginResponseSchema = object({
	accessToken: string(),
	expiresIn: number(),
});

export type LoginResponse = InferOutput<typeof loginResponseSchema>;

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

export type Company = InferOutput<typeof companySchema>;

/** Shape of `GET /companies`: the companies the authenticated user belongs to. */
export const companiesResponseSchema = array(companySchema);

export type CompaniesResponse = InferOutput<typeof companiesResponseSchema>;

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
