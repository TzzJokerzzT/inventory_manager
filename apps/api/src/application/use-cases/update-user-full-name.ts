import type { User } from "../../domain/entities/user.js";
import { UserNotProvisionedError } from "../../domain/errors/user-not-provisioned-error.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";

export interface UpdateUserFullNameDependencies {
	userRepository: UserRepository;
}

/**
 * Sets or clears the display name of the authenticated user.
 *
 * The caller is always the `User` entity `requireUser` already resolved -- the
 * id is never taken from the request body, the same invariant `company_id`
 * follows. `fullName` is passed through to the port, which owns the single
 * normalisation point (`null`, `""` and whitespace-only all clear the name).
 *
 * It returns the UPDATED entity on purpose: `request.user` was resolved before
 * this write, so building the response from it would answer a 200 with the
 * previous name. The caller passes the returned entity to `GET /me`'s view.
 * When the port reports the row is gone (a race), it throws
 * `UserNotProvisionedError` so the HTTP layer answers the same 403
 * `user_not_provisioned` the middleware already emits -- never a fabricated
 * user, never a raw 500.
 */
export class UpdateUserFullNameUseCase {
	private readonly userRepository: UserRepository;

	constructor(dependencies: UpdateUserFullNameDependencies) {
		this.userRepository = dependencies.userRepository;
	}

	async execute(user: User, fullName: string | null): Promise<User> {
		const updated = await this.userRepository.updateFullName(user.id, fullName);

		if (updated === null) {
			throw new UserNotProvisionedError();
		}

		return updated;
	}
}
