import type { Company } from "../../domain/entities/company.js";
import type { User } from "../../domain/entities/user.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { NotificationRepository } from "../../domain/repositories/notification-repository.js";

/**
 * One notification as the caller sees it.
 *
 * It carries the event (`type`, `createdAt`) and whether it was read, never
 * the raw `payload` or `dedupeKey`: those are storage details, and the ids the
 * reader needs are resolved into `company`.
 *
 * `company` is `null` when the batch read did not resolve it (or the payload
 * carried no `companyId`). The event is the fact, the company is context: a
 * missing company never hides the notification, it only costs the UI the link
 * to where it happened -- the same rule the pending-invitation read applies to
 * a missing inviter.
 */
export interface NotificationView {
	id: string;
	type: string;
	createdAt: string;
	readAt: string | null;
	company: Company | null;
}

export interface ListNotificationsDependencies {
	notificationRepository: NotificationRepository;
	companyRepository: CompanyRepository;
}

/**
 * Builds the payload behind `GET /me/notifications`: the caller's events,
 * newest first, each with the company it happened in.
 *
 * The subject is the resolved `User`, never an id from the request, so a
 * caller can only ever read their own notifications. The companies are
 * resolved with a single `findByIds` call after the notification read --
 * deduplicated first -- so the whole read is two queries and never N+1.
 */
export class ListNotificationsUseCase {
	private readonly notificationRepository: NotificationRepository;
	private readonly companyRepository: CompanyRepository;

	constructor(dependencies: ListNotificationsDependencies) {
		this.notificationRepository = dependencies.notificationRepository;
		this.companyRepository = dependencies.companyRepository;
	}

	async execute(user: User): Promise<NotificationView[]> {
		const notifications = await this.notificationRepository.findByUser(user.id);

		if (notifications.length === 0) {
			return [];
		}

		// Deduplicate before the batch read: several events about the same
		// company must cost one lookup, not one per event. Only a string
		// `companyId` is a lookup candidate; anything else answers `company:
		// null` below.
		const companyIds = [
			...new Set(
				notifications.flatMap((notification) => {
					const companyId = notification.payload.companyId;
					return typeof companyId === "string" ? [companyId] : [];
				}),
			),
		];
		const companies = await this.companyRepository.findByIds(companyIds);
		const companiesById = new Map(
			companies.map((company) => [company.id, company]),
		);

		return notifications.map((notification) => {
			const companyId = notification.payload.companyId;

			return {
				id: notification.id,
				type: notification.type,
				createdAt: notification.createdAt.toISOString(),
				readAt: notification.readAt?.toISOString() ?? null,
				company:
					typeof companyId === "string"
						? (companiesById.get(companyId) ?? null)
						: null,
			};
		});
	}
}
