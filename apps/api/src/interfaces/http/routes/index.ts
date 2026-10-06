import { Router } from "express";
import type { CompanyController } from "../controllers/company-controller.js";
import { companyRoutes } from "./company-routes.js";
import { healthRoutes } from "./health-routes.js";

export interface HttpRoutesDependencies {
	company: CompanyController;
}

export function buildRoutes(dependencies: HttpRoutesDependencies): Router {
	const router = Router();
	router.use(healthRoutes());
	router.use(companyRoutes(dependencies.company));
	return router;
}
