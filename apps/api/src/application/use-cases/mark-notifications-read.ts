import type { User } from "../../domain/entities/user.js";
import type { NotificationRepository } from "../../domain/repositories/notification-repository.js";

export interface MarkNotificationsReadDependencies {
	notificationRepository: NotificationRepository;
}

/**
 * Marks all of the caller's unread notifications as read.
 *
 * The subject is the resolved `User`, never an id from the request, so a
 * caller can only ever touch their own rows -- the same scoping rule the read
 * applies. It is one action ("mark everything read"), not one call per
 * notification, so the UI needs a single button and the endpoint stays
 * idempotent: marking again changes nothing.
 */
export class MarkNotificationsReadUseCase {
	private readonly notificationRepository: NotificationRepository;

	constructor(dependencies: MarkNotificationsReadDependencies) {
		this.notificationRepository = dependencies.notificationRepository;
	}

	async execute(user: User): Promise<void> {
		await this.notificationRepository.markAllRead(user.id);
	}
}
