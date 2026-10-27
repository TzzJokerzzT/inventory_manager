import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { CreateCategoryUseCase } from "../../../application/use-cases/create-category.js";
import type { DeleteCategoryUseCase } from "../../../application/use-cases/delete-category.js";
import type { ListCategoriesUseCase } from "../../../application/use-cases/list-categories.js";
import type { UpdateCategoryUseCase } from "../../../application/use-cases/update-category.js";
import {
	createCategorySchema,
	updateCategorySchema,
} from "../validators/category-validator.js";
import { resolvedCompanyContext } from "./company-controller.js";

/**
 * The category id in the path is a UUID, validated before it reaches a use case
 * for the same reason `requireCompanyContext` validates the company id: a
 * malformed id is a client mistake (400) and never a lookup that could leak
 * whether a well-formed id exists.
 */
const categoryIdSchema = v.pipe(v.string(), v.uuid());

export interface CategoryControllerDependencies {
	list: ListCategoriesUseCase;
	create: CreateCategoryUseCase;
	update: UpdateCategoryUseCase;
	remove: DeleteCategoryUseCase;
}

export interface CategoryController {
	list: RequestHandler;
	create: RequestHandler;
	update: RequestHandler;
	remove: RequestHandler;
}

/**
 * Reads the category id from the path, validated as a UUID. It returns
 * `undefined` for a malformed value so each handler answers the same 400
 * instead of passing an unvalidated string down to a lookup.
 */
function categoryIdOrUndefined(request: Request): string | undefined {
	const parsed = v.safeParse(categoryIdSchema, request.params.categoryId);
	return parsed.success ? parsed.output : undefined;
}

/**
 * HTTP adapter for the category use cases (S4).
 *
 * The controller is mounted on the `companyScoped` router, so every handler runs
 * after `requireCompanyContext`: the company id and the caller's role come from
 * `request.companyContext`, never from the body. That is what makes the
 * isolation (S4) impossible to forget here.
 *
 * The reads carry no role and the writes are decided by `manage_products` in the
 * use cases, not here: a controller that pre-checked a role would be a second
 * copy of the matrix.
 *
 * The dependencies are read **inside** each handler, never destructured at
 * factory time: the test suites build an app with inert fixtures, and
 * destructuring would evaluate them before the route ever runs.
 */
export function createCategoryController(
	dependencies: CategoryControllerDependencies,
): CategoryController {
	return {
		list: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);

				const categories = await dependencies.list.execute({
					companyId: context.companyId,
				});

				response.status(StatusCodes.OK).json(categories);
			} catch (error) {
				next(error);
			}
		},
		create: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const input = v.parse(createCategorySchema, request.body);

				const category = await dependencies.create.execute(input, {
					companyId: context.companyId,
					actorRole: context.role,
				});

				response.status(StatusCodes.CREATED).json(category);
			} catch (error) {
				next(error);
			}
		},
		update: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const categoryId = categoryIdOrUndefined(request);

				if (categoryId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid category id" },
					});
					return;
				}

				const input = v.parse(updateCategorySchema, request.body);

				const category = await dependencies.update.execute(
					{ categoryId, ...input },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				response.status(StatusCodes.OK).json(category);
			} catch (error) {
				next(error);
			}
		},
		remove: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);
				const categoryId = categoryIdOrUndefined(request);

				if (categoryId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid category id" },
					});
					return;
				}

				await dependencies.remove.execute(
					{ categoryId },
					{
						companyId: context.companyId,
						actorRole: context.role,
					},
				);

				// 204: a hard delete has nothing to say about the row it removed.
				response.status(StatusCodes.NO_CONTENT).end();
			} catch (error) {
				next(error);
			}
		},
	};
}
