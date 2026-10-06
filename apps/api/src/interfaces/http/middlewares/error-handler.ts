import type { ErrorRequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { ValiError } from "valibot";
import { DomainError } from "../../../domain/errors/domain-error.js";

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

	const status = getHttpStatus(error);
	if (status !== undefined) {
		response
			.status(status)
			.json({ error: { message: getErrorMessage(error) } });
		return;
	}

	response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
		error: { message: "Internal server error" },
	});
};
