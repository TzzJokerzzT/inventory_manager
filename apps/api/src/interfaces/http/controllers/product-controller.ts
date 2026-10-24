import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { CreateProductUseCase } from "../../../application/use-cases/create-product.js";
import type { DeleteProductUseCase } from "../../../application/use-cases/delete-product.js";
import type { GetProductUseCase } from "../../../application/use-cases/get-product.js";
import type { ListProductUnitsUseCase } from "../../../application/use-cases/list-product-units.js";
import type { ListProductsUseCase } from "../../../application/use-cases/list-products.js";
import type { PurgeProductUseCase } from "../../../application/use-cases/purge-product.js";
import type { RestoreProductUseCase } from "../../../application/use-cases/restore-product.js";
import type { UpdateProductUseCase } from "../../../application/use-cases/update-product.js";
import {
	createProductSchema,
	listProductsQuerySchema,
	listProductUnitsQuerySchema,
	updateProductSchema,
} from "../validators/product-validator.js";
import { resolvedCompanyContext } from "./company-controller.js";

/**
 * The product id in the path is a UUID, validated before it reaches a use case
 * for the same reason `requireCompanyContext` validates the company id: a
 * malformed id is a client mistake (400) and never a lookup that could leak
 * whether a well-formed id exists.
 */
const productIdSchema = v.pipe(v.string(), v.uuid());

export interface ProductControllerDependencies {
	list: ListProductsUseCase;
	create: CreateProductUseCase;
	get: GetProductUseCase;
	/** The concrete units of a product, which the sale screen lists (L23). */
	units: ListProductUnitsUseCase;
	update: UpdateProductUseCase;
	remove: DeleteProductUseCase;
	restore: RestoreProductUseCase;
	purge: PurgeProductUseCase;
}

export interface ProductController {
	list: RequestHandler;
	create: RequestHandler;
	get: RequestHandler;
	units: RequestHandler;
	update: RequestHandler;
	remove: RequestHandler;
	restore: RequestHandler;
	purge: RequestHandler;
}

/**
 * Reads the product id from the path, validated as a UUID. It returns
 * `undefined` for a malformed value so each handler answers the same 400
 * instead of passing an unvalidated string down to a lookup.
 */
function productIdOrUndefined(request: Request): string | undefined {
	const parsed = v.safeParse(productIdSchema, request.params.productId);
	return parsed.success ? parsed.output : undefined;
}

/**
 * HTTP adapter for the product use cases (MI-7).
 *
 * The controller is mounted on the `companyScoped` router, so every handler
 * runs after `requireCompanyContext`: the company id and the caller's role
 * come from `request.companyContext`, never from the body. That is what makes
 * the isolation (EMP-03) and the authorization (S6) impossible to forget here.
 *
 * The dependencies are read **inside** each handler, never destructured at
 * factory time: the test suites build an app with inert fixtures, and
 * destructuring would evaluate them before the route ever runs.
 */
export function createProductController(
	dependencies: ProductControllerDependencies,
): ProductController {
	return {
		list: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const query = v.parse(listProductsQuerySchema, request.query);

				const products = await dependencies.list.execute(
					{ search: query.search, deleted: query.deleted },
					{ companyId: context.companyId },
				);

				response.status(StatusCodes.OK).json(products);
			} catch (error) {
				next(error);
			}
		},
		create: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const input = v.parse(createProductSchema, request.body);

				const product = await dependencies.create.execute(input, {
					companyId: context.companyId,
					actorRole: context.role,
				});

				response.status(StatusCodes.CREATED).json(product);
			} catch (error) {
				next(error);
			}
		},
		get: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const productId = productIdOrUndefined(request);

				if (productId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid product id" },
					});
					return;
				}

				const product = await dependencies.get.execute(
					{ productId },
					{ companyId: context.companyId },
				);

				response.status(StatusCodes.OK).json(product);
			} catch (error) {
				next(error);
			}
		},
		units: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const productId = productIdOrUndefined(request);

				if (productId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid product id" },
					});
					return;
				}

				const query = v.parse(listProductUnitsQuerySchema, request.query);

				const units = await dependencies.units.execute(
					{ productId, status: query.status },
					{ companyId: context.companyId },
				);

				response.status(StatusCodes.OK).json(units);
			} catch (error) {
				next(error);
			}
		},
		update: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const productId = productIdOrUndefined(request);

				if (productId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid product id" },
					});
					return;
				}

				const input = v.parse(updateProductSchema, request.body);

				const product = await dependencies.update.execute(
					{ productId, ...input },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				response.status(StatusCodes.OK).json(product);
			} catch (error) {
				next(error);
			}
		},
		remove: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const productId = productIdOrUndefined(request);

				if (productId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid product id" },
					});
					return;
				}

				await dependencies.remove.execute(
					{ productId },
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
		restore: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const productId = productIdOrUndefined(request);

				if (productId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid product id" },
					});
					return;
				}

				const product = await dependencies.restore.execute(
					{ productId },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				// 200 with the product: unlike the delete, the caller gets the row
				// back active, so the client can drop its stale copy instead of
				// re-reading the catalogue.
				response.status(StatusCodes.OK).json(product);
			} catch (error) {
				next(error);
			}
		},
		purge: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const productId = productIdOrUndefined(request);

				if (productId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid product id" },
					});
					return;
				}

				await dependencies.purge.execute(
					{ productId },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				// 204 with an empty body: unlike the restore, the row is gone, so
				// there is nothing left to hand back.
				response.status(StatusCodes.NO_CONTENT).end();
			} catch (error) {
				next(error);
			}
		},
	};
}
