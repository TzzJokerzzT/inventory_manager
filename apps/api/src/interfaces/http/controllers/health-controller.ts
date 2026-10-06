import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export function healthController(_request: Request, response: Response): void {
	response.status(StatusCodes.OK).json({
		status: "ok",
		uptime: process.uptime(),
	});
}
