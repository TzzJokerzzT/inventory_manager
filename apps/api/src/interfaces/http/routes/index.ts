import { type RequestHandler, Router } from "express";
import type { AuthController } from "../controllers/auth-controller.js";
import type { CompanyController } from "../controllers/company-controller.js";
import { authRoutes } from "./auth-routes.js";
import { companyRoutes } from "./company-routes.js";
import { healthRoutes } from "./health-routes.js";

export interface HttpRoutesDependencies {
	company: CompanyController;
	auth: AuthController;
	requireAuth: RequestHandler;
}

export function buildRoutes(dependencies: HttpRoutesDependencies): Router {
	const router = Router();
	router.use(healthRoutes());
	router.use(authRoutes(dependencies.auth));
	router.use("/companies", dependencies.requireAuth);
	router.use(companyRoutes(dependencies.company));
	return router;
}
