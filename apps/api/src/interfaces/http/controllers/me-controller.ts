import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { parse } from "valibot";
import type { GetCurrentUserUseCase } from "../../../application/use-cases/get-current-user.js";
import type { UpdateUserFullNameUseCase } from "../../../application/use-cases/update-user-full-name.js";
import type { User } from "../../../domain/entities/user.js";
import { updateMeSchema } from "../validators/me-validator.js";

export interface MeControllerDependencies {
	getCurrentUser: GetCurrentUserUseCase;
	updateUserFullName: UpdateUserFullNameUseCase;
}

export interface MeController {
	get: RequestHandler;
	update: RequestHandler;
}

/**
 * The resolved user the `/me` route is guaranteed to have: `requireUser` runs
 * before this controller, so a missing user is a programming error and not
 * something to work around by inventing one.
 */
function resolvedUser(request: Request): User {
	const user = request.user;
	if (user === undefined) {
		throw new Error(
			"requireUser must run before the me controller; the route wiring guarantees a resolved user",
		);
	}
	return user;
}

/**
 * HTTP adapter for the `/me` endpoints.
 *
 * It only reads the resolved user and delegates the work to the use cases: the
 * controller never assembles data or touches a repository. The use case groups
 * the public identity under `user`; the wire contract is flat (no `{ data }`
 * wrapper, no `user` envelope, like the rest of the API), so the controller
 * spreads that view to the top level and adds the memberships. The use case
 * receives the resolved `User` entity, not an id, so it can emit `email` and
 * `createdAt` without a second user lookup.
 *
 * `PATCH /me` answers with the same representation as `GET /me`, so both
 * handlers share the view assembly and only differ in the entity they pass to
 * it (see the `update` handler for why it must be the updated one).
 */
export function createMeController(
	dependencies: MeControllerDependencies,
): MeController {
	return {
		get: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const { user: view, memberships } =
					await dependencies.getCurrentUser.execute(user);
				response.status(StatusCodes.OK).json({ ...view, memberships });
			} catch (error) {
				next(error);
			}
		},
		update: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const input = parse(updateMeSchema, request.body);

				const updated = await dependencies.updateUserFullName.execute(
					user,
					input.fullName,
				);

				// Answer from the UPDATED entity, never the resolved one: `requireUser`
				// read `request.user` before this write, so rebuilding the view from it
				// would return the previous name in a 200. That is exactly why the use
				// case hands the entity back instead of returning void.
				const { user: view, memberships } =
					await dependencies.getCurrentUser.execute(updated);

				response.status(StatusCodes.OK).json({ ...view, memberships });
			} catch (error) {
				next(error);
			}
		},
	};
}
