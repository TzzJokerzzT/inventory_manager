import type { ErrorRequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { ValiError } from "valibot";
import { DomainError } from "../../../domain/errors/domain-error.js";
import { IdentityProviderUnavailableError } from "../../../domain/errors/identity-provider-unavailable-error.js";
import { InvalidCredentialsError } from "../../../domain/errors/invalid-credentials-error.js";

function getHttpStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const candidate =
		(error as { status?: unknown }).status ??
		(error as { statusCode?: unknown }).statusCode;

	return typeof candidate === "number" ? candidate : undefined;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return "Request failed";
}

/**
 * RFC 6750 expects a `WWW-Authenticate` challenge on 401 responses, and
 * `express-oauth2-jwt-bearer` stores it on the error it throws. Forward only
 * this one header by name: errors are reachable from untrusted input in other
 * code paths, so a generic `response.set(error.headers)` would turn any future
 * error that carries a `headers` property into a header-injection vector.
 */
function getWwwAuthenticateHeader(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const headers = (error as { headers?: unknown }).headers;
	if (typeof headers !== "object" || headers === null) {
		return undefined;
	}

	const value = (headers as Record<string, unknown>)["WWW-Authenticate"];
	return typeof value === "string" ? value : undefined;
}

/**
 * Last middleware in the chain. It maps known error kinds to HTTP statuses and
 * hides unexpected errors behind a generic 500.
 */
export const errorHandler: ErrorRequestHandler = (
	error,
	_request,
	response,
	_next,
) => {
	if (error instanceof DomainError) {
		response.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
			error: { message: error.message },
		});
		return;
	}

	if (error instanceof ValiError) {
		response.status(StatusCodes.BAD_REQUEST).json({
			error: {
				message: "Invalid request body",
				issues: error.issues.map((issue) => issue.message),
			},
		});
		return;
	}

	if (error instanceof InvalidCredentialsError) {
		response.status(StatusCodes.UNAUTHORIZED).json({
			error: { message: error.message },
		});
		return;
	}

	if (error instanceof IdentityProviderUnavailableError) {
		response.status(StatusCodes.SERVICE_UNAVAILABLE).json({
			error: { message: error.message },
		});
		return;
	}

	const status = getHttpStatus(error);
	if (status !== undefined) {
		const wwwAuthenticate = getWwwAuthenticateHeader(error);
		if (wwwAuthenticate !== undefined) {
			response.setHeader("WWW-Authenticate", wwwAuthenticate);
		}

		response
			.status(status)
			.json({ error: { message: getErrorMessage(error) } });
		return;
	}

	response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
		error: { message: "Internal server error" },
	});
};
