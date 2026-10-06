import { Router } from "express";
import { healthController } from "../controllers/health-controller.js";

export function healthRoutes(): Router {
	const router = Router();
	router.get("/health", healthController);
	return router;
}
