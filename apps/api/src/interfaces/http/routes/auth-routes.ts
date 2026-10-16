import { Router } from "express";
import type { AuthController } from "../controllers/auth-controller.js";
import {
	createAuthLoginRateLimiter,
	createAuthRefreshRateLimiter,
	createAuthRegisterRateLimiter,
} from "../middlewares/rate-limit.js";

export function authRoutes(controller: AuthController): Router {
	const router = Router();
	router.post("/auth/login", createAuthLoginRateLimiter(), controller.login);
	router.post(
		"/auth/register",
		createAuthRegisterRateLimiter(),
		controller.register,
	);
	router.post(
		"/auth/refresh",
		createAuthRefreshRateLimiter(),
		controller.refresh,
	);
	// No dedicated limiter: logout clears a cookie and issues no tokens, so
	// there is no token oracle to protect.
	router.post("/auth/logout", controller.logout);
	return router;
}
