import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { CreateCustomerUseCase } from "../../../application/use-cases/create-customer.js";
import type { DeleteCustomerUseCase } from "../../../application/use-cases/delete-customer.js";
import type { GetCustomerUseCase } from "../../../application/use-cases/get-customer.js";
import type { ListCustomersUseCase } from "../../../application/use-cases/list-customers.js";
import type { UpdateCustomerUseCase } from "../../../application/use-cases/update-customer.js";
import {
	createCustomerSchema,
	listCustomersQuerySchema,
	updateCustomerSchema,
} from "../validators/customer-validator.js";
import { resolvedCompanyContext } from "./company-controller.js";

/**
 * The customer id in the path is a UUID, validated before it reaches a use case
 * for the same reason `requireCompanyContext` validates the company id: a
 * malformed id is a client mistake (400) and never a lookup that could leak
 * whether a well-formed id exists.
 */
const customerIdSchema = v.pipe(v.string(), v.uuid());

export interface CustomerControllerDependencies {
	list: ListCustomersUseCase;
	create: CreateCustomerUseCase;
	get: GetCustomerUseCase;
	update: UpdateCustomerUseCase;
	remove: DeleteCustomerUseCase;
}

export interface CustomerController {
	list: RequestHandler;
	create: RequestHandler;
	get: RequestHandler;
	update: RequestHandler;
	remove: RequestHandler;
}

/**
 * Reads the customer id from the path, validated as a UUID. It returns
 * `undefined` for a malformed value so each handler answers the same 400
 * instead of passing an unvalidated string down to a lookup.
 */
function customerIdOrUndefined(request: Request): string | undefined {
	const parsed = v.safeParse(customerIdSchema, request.params.customerId);
	return parsed.success ? parsed.output : undefined;
}

/**
 * HTTP adapter for the customer use cases (MI-11).
 *
 * The controller is mounted on the `companyScoped` router, so every handler
 * runs after `requireCompanyContext`: the company id and the caller's role come
 * from `request.companyContext`, never from the body. That is what makes the
 * isolation (EMP-03/S5) impossible to forget here, and it is also the whole
 * authorization rule (S6): an ACTIVE membership is what the middleware proved,
 * and every active role writes customers, so no handler checks a role.
 *
 * The dependencies are read **inside** each handler, never destructured at
 * factory time: the test suites build an app with inert fixtures, and
 * destructuring would evaluate them before the route ever runs.
 */
export function createCustomerController(
	dependencies: CustomerControllerDependencies,
): CustomerController {
	return {
		list: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const query = v.parse(listCustomersQuerySchema, request.query);

				const customers = await dependencies.list.execute(
					{ search: query.search },
					{ companyId: context.companyId },
				);

				response.status(StatusCodes.OK).json(customers);
			} catch (error) {
				next(error);
			}
		},
		create: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const input = v.parse(createCustomerSchema, request.body);

				const customer = await dependencies.create.execute(input, {
					companyId: context.companyId,
					actorRole: context.role,
				});

				response.status(StatusCodes.CREATED).json(customer);
			} catch (error) {
				next(error);
			}
		},
		get: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const customerId = customerIdOrUndefined(request);

				if (customerId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid customer id" },
					});
					return;
				}

				const customer = await dependencies.get.execute(
					{ customerId },
					{ companyId: context.companyId },
				);

				response.status(StatusCodes.OK).json(customer);
			} catch (error) {
				next(error);
			}
		},
		update: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const customerId = customerIdOrUndefined(request);

				if (customerId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid customer id" },
					});
					return;
				}

				const input = v.parse(updateCustomerSchema, request.body);

				const customer = await dependencies.update.execute(
					{ customerId, ...input },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				response.status(StatusCodes.OK).json(customer);
			} catch (error) {
				next(error);
			}
		},
		remove: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const customerId = customerIdOrUndefined(request);

				if (customerId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid customer id" },
					});
					return;
				}

				await dependencies.remove.execute(
					{ customerId },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				// 204: the row is kept with `deletedAt`, but the response has
				// nothing to say about it.
				response.status(StatusCodes.NO_CONTENT).end();
			} catch (error) {
				next(error);
			}
		},
	};
}
