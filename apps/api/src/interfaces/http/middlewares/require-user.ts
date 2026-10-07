import type { RequestHandler } from "express";
import type { User } from "../../../domain/entities/user.js";
import { UserNotProvisionedError } from "../../../domain/errors/user-not-provisioned-error.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";

/**
 * Request augmentation chosen over a `res.locals` accessor for the same reason
 * `express-oauth2-jwt-bearer` augments `request.auth`: the resolved user is
 * request-scoped identity that belongs next to the auth result, not response
 * state. `requireUser` is what populates it, so it stays `undefined` on routes
 * that do not run the middleware (for example `/health`).
 */
declare global {
	namespace Express {
		interface Request {
			user?: User;
		}
	}
}

export interface RequireUserDependencies {
	userRepository: UserRepository;
}

/**
 * Builds the `requireUser` middleware, which must run *after* `requireAuth`.
 *
 * It reads the `sub` claim the verifier left on `request.auth` and resolves it
 * to a `users` row. A valid token must always resolve to a row: only our API
 * issues tokens and the MI-53 gate creates the row before issuing them, so a
 * token that does not resolve is an inconsistency, answered with
 * 403 `user_not_provisioned` instead of silently inventing a user.
 */
export function createRequireUser({
	userRepository,
}: RequireUserDependencies): RequestHandler {
	return async (request, _response, next) => {
		try {
			const sub = request.auth?.payload.sub;
			if (sub === undefined) {
				throw new UserNotProvisionedError();
			}

			const user = await userRepository.findByAuth0Sub(sub);
			if (user === null) {
				throw new UserNotProvisionedError();
			}

			request.user = user;
			next();
		} catch (error) {
			next(error);
		}
	};
}
