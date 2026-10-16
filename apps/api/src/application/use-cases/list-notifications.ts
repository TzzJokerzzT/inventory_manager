import type { Company } from "../../domain/entities/company.js";
import type { User } from "../../domain/entities/user.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { NotificationRepository } from "../../domain/repositories/notification-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
// Shared on purpose: the actor of an event and the inviter of an invitation
// are the same minimal user shape, and one type cannot drift from itself.
import type { UserSummary } from "./list-pending-invitations.js";

/**
 * One notification as the caller sees it.
 *
 * It carries the event (`type`, `createdAt`) and whether it was read, never
 * the raw `payload` or `dedupeKey`: those are storage details, and the ids the
 * reader needs are resolved into `company` and `actor`.
 *
 * `company` and `actor` are `null` when the batch read did not resolve them
 * (or the payload carried no id). The event is the fact, the context is
 * optional: a missing company or actor never hides the notification, and the
 * pending-invitation read applies the same rule to a missing inviter.
 */
export interface NotificationView {
	id: string;
	type: string;
	createdAt: string;
	readAt: string | null;
	company: Company | null;
	/** Who triggered the event, or `null` when it could not be resolved. */
	actor: UserSummary | null;
}

export interface ListNotificationsDependencies {
	notificationRepository: NotificationRepository;
	companyRepository: CompanyRepository;
	userRepository: UserRepository;
}

/**
 * Builds the payload behind `GET /me/notifications`: the caller's events,
 * newest first, each with the company it happened in and who triggered it.
 *
 * The subject is the resolved `User`, never an id from the request, so a
 * caller can only ever read their own notifications. The companies and the
 * actors are resolved with a single `findByIds` call each after the
 * notification read -- deduplicated first -- so the whole read is three
 * queries and never N+1.
 */
export class ListNotificationsUseCase {
	private readonly notificationRepository: NotificationRepository;
	private readonly companyRepository: CompanyRepository;
	private readonly userRepository: UserRepository;

	constructor(dependencies: ListNotificationsDependencies) {
		this.notificationRepository = dependencies.notificationRepository;
		this.companyRepository = dependencies.companyRepository;
		this.userRepository = dependencies.userRepository;
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

		// The actor is read the same way as the company: one deduplicated batch.
		// A notification written before the actor id existed has no candidate and
		// answers `actor: null` below instead of hiding the event.
		const actorIds = [
			...new Set(
				notifications.flatMap((notification) => {
					const actorId = notification.payload.actorId;
					return typeof actorId === "string" ? [actorId] : [];
				}),
			),
		];
		const actors = await this.userRepository.findByIds(actorIds);
		const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

		return notifications.map((notification) => {
			const companyId = notification.payload.companyId;
			const actorId = notification.payload.actorId;
			const actor =
				typeof actorId === "string" ? actorsById.get(actorId) : undefined;

			return {
				id: notification.id,
				type: notification.type,
				createdAt: notification.createdAt.toISOString(),
				readAt: notification.readAt?.toISOString() ?? null,
				company:
					typeof companyId === "string"
						? (companiesById.get(companyId) ?? null)
						: null,
				actor: actor
					? { id: actor.id, fullName: actor.fullName, email: actor.email }
					: null,
			};
		});
	}
}
