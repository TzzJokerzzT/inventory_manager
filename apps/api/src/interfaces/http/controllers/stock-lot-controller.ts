import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { RegisterLotUseCase } from "../../../application/use-cases/register-lot.js";
import { createLotSchema } from "../validators/stock-lot-validator.js";
import { resolvedCompanyContext, resolvedUser } from "./company-controller.js";

export interface LotControllerDependencies {
	register: RegisterLotUseCase;
}

export interface LotController {
	create: RequestHandler;
}

/**
 * HTTP adapter for the purchase lot use cases (S6).
 *
 * The controller is mounted on the `companyScoped` router, so the handler runs
 * after `requireCompanyContext`: the company id and the caller's role come from
 * `request.companyContext`, never from the body, and the actor comes from the
 * token through `requireUser`. Who may write is decided by the `manage_products`
 * row of the matrix inside the use case, not here: a controller that pre-checked
 * a role would be a second copy of the matrix.
 *
 * The dependencies are read **inside** the handler, never destructured at
 * factory time: the test suites build an app with inert fixtures, and
 * destructuring would evaluate them before the route ever runs.
 */
export function createLotController(
	dependencies: LotControllerDependencies,
): LotController {
	return {
		create: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const user = resolvedUser(request);
				const input = v.parse(createLotSchema, request.body);

				const lot = await dependencies.register.execute(input, {
					companyId: context.companyId,
					actorRole: context.role,
					actorId: user.id,
				});

				// 201 with the lot and its units: `measureTotal` and the per-unit
				// costs are what the client shows instead of recomputing them.
				response.status(StatusCodes.CREATED).json(lot);
			} catch (error) {
				next(error);
			}
		},
	};
}
