import { Router } from "express";
import type { AuthController } from "../controllers/auth-controller.js";
import { createAuthLoginRateLimiter } from "../middlewares/rate-limit.js";

export function authRoutes(controller: AuthController): Router {
	const router = Router();
	router.post("/auth/login", createAuthLoginRateLimiter(), controller.login);
	return router;
}
