import { type InferOutput, number, object, safeParse, string } from "valibot";
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
