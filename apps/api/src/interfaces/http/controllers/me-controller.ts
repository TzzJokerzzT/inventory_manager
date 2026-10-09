import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import type { GetCurrentUserUseCase } from "../../../application/use-cases/get-current-user.js";
import type { User } from "../../../domain/entities/user.js";

export interface MeControllerDependencies {
	getCurrentUser: GetCurrentUserUseCase;
}

export interface MeController {
	get: RequestHandler;
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
 * HTTP adapter for `GET /me`.
 *
 * It only reads the resolved user and delegates the join to the use case: the
 * controller never assembles data or touches a repository. The use case groups
 * the public identity under `user`; the wire contract is flat (no `{ data }`
 * wrapper, no `user` envelope, like the rest of the API), so the controller
 * spreads that view to the top level and adds the memberships. The use case
 * receives the resolved `User` entity, not an id, so it can emit `email` and
 * `createdAt` without a second user lookup.
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
	};
}
