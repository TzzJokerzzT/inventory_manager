import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { ListStockMovementsUseCase } from "../../../application/use-cases/list-stock-movements.js";
import type { RegisterStockMovementUseCase } from "../../../application/use-cases/register-stock-movement.js";
import type { User } from "../../../domain/entities/user.js";
import {
	createStockMovementSchema,
	listStockMovementsQuerySchema,
} from "../validators/stock-movement-validator.js";
import { resolvedCompanyContext, resolvedUser } from "./company-controller.js";

export interface StockMovementControllerDependencies {
	register: RegisterStockMovementUseCase;
	list: ListStockMovementsUseCase;
}

export interface StockMovementController {
	list: RequestHandler;
	create: RequestHandler;
}

/**
 * HTTP adapter for the stock movement use cases (MI-8).
 *
 * The controller is mounted on the `companyScoped` router, so every handler
 * runs after `requireCompanyContext`: the company comes from the path and the
 * membership, never from the body, and the actor comes from the token through
 * `requireUser`. Any ACTIVE membership may register (S6), which is exactly what
 * the context already proved, so there is no extra role check here.
 *
 * The dependencies are read **inside** each handler, never destructured at
 * factory time: the test suites build an app with inert fixtures, and
 * destructuring would evaluate them before the route ever runs.
 */
export function createStockMovementController(
	dependencies: StockMovementControllerDependencies,
): StockMovementController {
	return {
		list: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const query = v.parse(listStockMovementsQuerySchema, request.query);

				const movements = await dependencies.list.execute(
					{
						productId: query.productId,
						customerId: query.customerId,
						type: query.type,
						limit: query.limit,
					},
					{ companyId: context.companyId },
				);

				response.status(StatusCodes.OK).json(movements);
			} catch (error) {
				next(error);
			}
		},
		create: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const user = resolvedUser(request);
				const input = v.parse(createStockMovementSchema, request.body);

				const result = await dependencies.register.execute(input, {
					companyId: context.companyId,
					actor: actorFrom(user),
				});

				// The movement plus the stock **after** it: the stock is a
				// consequence of the movement, never an input.
				response.status(StatusCodes.CREATED).json({
					...result.movement,
					stockQuantity: result.stockQuantity,
				});
			} catch (error) {
				next(error);
			}
		},
	};
}

/** The caller from the token, reduced to the audit fields of a movement. */
function actorFrom(user: User) {
	return { id: user.id, fullName: user.fullName, email: user.email };
}
