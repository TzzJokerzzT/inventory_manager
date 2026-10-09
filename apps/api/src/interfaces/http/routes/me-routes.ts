import { type RequestHandler, Router } from "express";
import type { MeController } from "../controllers/me-controller.js";

/**
 * `GET /me` route.
 *
 * It runs behind `requireAuth` then `requireUser`, the same pair as the
 * `/companies` chain, but it is mounted on its own router: `/me` is an identity
 * endpoint and is not bound to any single company, so it must never run
 * through `requireCompanyContext`.
 */
export function meRoutes(
	controller: MeController,
	requireAuth: RequestHandler,
	requireUser: RequestHandler,
): Router {
	const router = Router();
	router.get("/me", requireAuth, requireUser, controller.get);
	return router;
}
