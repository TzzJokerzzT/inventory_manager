import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { CreateSupplierUseCase } from "../../../application/use-cases/create-supplier.js";
import type { DeleteSupplierUseCase } from "../../../application/use-cases/delete-supplier.js";
import type { ListSuppliersUseCase } from "../../../application/use-cases/list-suppliers.js";
import type { UpdateSupplierUseCase } from "../../../application/use-cases/update-supplier.js";
import {
	createSupplierSchema,
	updateSupplierSchema,
} from "../validators/supplier-validator.js";
import { resolvedCompanyContext } from "./company-controller.js";

/**
 * The supplier id in the path is a UUID, validated before it reaches a use case
 * for the same reason `requireCompanyContext` validates the company id: a
 * malformed id is a client mistake (400) and never a lookup that could leak
 * whether a well-formed id exists.
 */
const supplierIdSchema = v.pipe(v.string(), v.uuid());

export interface SupplierControllerDependencies {
	list: ListSuppliersUseCase;
	create: CreateSupplierUseCase;
	update: UpdateSupplierUseCase;
	remove: DeleteSupplierUseCase;
}

export interface SupplierController {
	list: RequestHandler;
	create: RequestHandler;
	update: RequestHandler;
	remove: RequestHandler;
}

/**
 * Reads the supplier id from the path, validated as a UUID. It returns
 * `undefined` for a malformed value so each handler answers the same 400
 * instead of passing an unvalidated string down to a lookup.
 */
function supplierIdOrUndefined(request: Request): string | undefined {
	const parsed = v.safeParse(supplierIdSchema, request.params.supplierId);
	return parsed.success ? parsed.output : undefined;
}

/**
 * HTTP adapter for the supplier use cases (S4).
 *
 * The controller is mounted on the `companyScoped` router, so every handler
 * runs after `requireCompanyContext`: the company id and the caller's role come
 * from `request.companyContext`, never from the body. That is what makes the
 * isolation (EMP-03) impossible to forget here.
 *
 * The reads carry no role and the writes are decided by `manage_products` in
 * the use cases, not here: a controller that pre-checked a role would be a
 * second copy of the matrix.
 *
 * The dependencies are read **inside** each handler, never destructured at
 * factory time: the test suites build an app with inert fixtures, and
 * destructuring would evaluate them before the route ever runs.
 */
export function createSupplierController(
	dependencies: SupplierControllerDependencies,
): SupplierController {
	return {
		list: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);

				const suppliers = await dependencies.list.execute({
					companyId: context.companyId,
				});

				response.status(StatusCodes.OK).json(suppliers);
			} catch (error) {
				next(error);
			}
		},
		create: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const input = v.parse(createSupplierSchema, request.body);

				const supplier = await dependencies.create.execute(input, {
					companyId: context.companyId,
					actorRole: context.role,
				});

				response.status(StatusCodes.CREATED).json(supplier);
			} catch (error) {
				next(error);
			}
		},
		update: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const supplierId = supplierIdOrUndefined(request);

				if (supplierId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid supplier id" },
					});
					return;
				}

				const input = v.parse(updateSupplierSchema, request.body);

				const supplier = await dependencies.update.execute(
					{ supplierId, ...input },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				response.status(StatusCodes.OK).json(supplier);
			} catch (error) {
				next(error);
			}
		},
		remove: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const supplierId = supplierIdOrUndefined(request);

				if (supplierId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid supplier id" },
					});
					return;
				}

				await dependencies.remove.execute(
					{ supplierId },
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
