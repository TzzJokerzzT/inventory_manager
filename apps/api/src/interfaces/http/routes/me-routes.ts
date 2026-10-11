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
 */
export function meRoutes(
	controller: MeController,
	requireAuth: RequestHandler,
	requireUser: RequestHandler,
): Router {
	const router = Router();
	router.get("/me", requireAuth, requireUser, controller.get);
	router.patch("/me", requireAuth, requireUser, controller.update);
	router.post(
		"/me/invitations/accept",
		requireAuth,
		requireUser,
		controller.acceptInvitations,
	);
	return router;
}
