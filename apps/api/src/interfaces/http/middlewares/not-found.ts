import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

export const notFoundHandler: RequestHandler = (request, response) => {
	response.status(StatusCodes.NOT_FOUND).json({
		error: {
			message: `Route not found: ${request.method} ${request.originalUrl}`,
		},
	});
};
