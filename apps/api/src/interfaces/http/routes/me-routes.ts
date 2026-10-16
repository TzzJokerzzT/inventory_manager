import { type RequestHandler, Router } from "express";
import type { MeController } from "../controllers/me-controller.js";

/**
 * `/me` routes.
 *
 * They run behind `requireAuth` then `requireUser`, the same pair as the
 * `/companies` chain, but they are mounted on their own router: `/me` is an
 * identity endpoint and is not bound to any single company, so it must never
 * run through `requireCompanyContext`. `PATCH /me` writes to the caller's own
 * row only; `requireUser` is what makes the subject implicit, so the body can
 * never name another user.
 *
 * `POST /me/invitations/accept` hangs off the same pair for the same reason:
 * accepting an invitation is an action on the caller's own account, and
 * requiring a company context first would make it unreachable exactly for the
 * user who has no ACTIVE membership yet -- the one who needs it.
 *
 * `GET /me/invitations` is the read counterpart and sits on the same pair for
 * the same reason: the invitee is not a member of the inviting company yet.
 * Both invitation routes are declared with their full `/me/invitations` path,
 * ahead of any future `/me/:param` route, so a parameterised route could never
 * shadow them.
 *
 * The notification routes hang off the same pair: a notification is addressed
 * to the caller's own user id, not to a company, so `requireCompanyContext`
 * would wrongly hide news about a company the caller does not belong to -- the
 * inviter *is* a member of it, but the route is about their identity. They are
 * declared ahead of any future `/me/:param` route for the same shadowing
 * reason as the invitation routes.
 */
export function meRoutes(
	controller: MeController,
	requireAuth: RequestHandler,
	requireUser: RequestHandler,
): Router {
	const router = Router();
	router.get("/me", requireAuth, requireUser, controller.get);
	router.patch("/me", requireAuth, requireUser, controller.update);
	router.get(
		"/me/invitations",
		requireAuth,
		requireUser,
		controller.listPendingInvitations,
	);
	router.post(
		"/me/invitations/accept",
		requireAuth,
		requireUser,
		controller.acceptInvitations,
	);
	router.get(
		"/me/notifications",
		requireAuth,
		requireUser,
		controller.listNotifications,
	);
	router.post(
		"/me/notifications/read",
		requireAuth,
		requireUser,
		controller.markNotificationsRead,
	);
	return router;
}
