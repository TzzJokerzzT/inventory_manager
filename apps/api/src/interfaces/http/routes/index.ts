import { type RequestHandler, Router } from "express";
import type { AuthController } from "../controllers/auth-controller.js";
import type { CompanyController } from "../controllers/company-controller.js";
import type { MeController } from "../controllers/me-controller.js";
import { authRoutes } from "./auth-routes.js";
import { companyRoutes } from "./company-routes.js";
import { healthRoutes } from "./health-routes.js";
import { meRoutes } from "./me-routes.js";

export interface HttpRoutesDependencies {
	company: CompanyController;
	me: MeController;
	auth: AuthController;
	requireAuth: RequestHandler;
	requireUser: RequestHandler;
}

export function buildRoutes(dependencies: HttpRoutesDependencies): Router {
	const router = Router();
	router.use(healthRoutes());
	router.use(authRoutes(dependencies.auth));
	// `/me` is an identity endpoint, not a company-scoped resource: it needs
	// `requireAuth` + `requireUser`, but it must NOT run through
	// `requireCompanyContext`. That is why it is registered here, outside the
	// `router.use("/companies", ...)` chain below.
	router.use(
		meRoutes(
			dependencies.me,
			dependencies.requireAuth,
			dependencies.requireUser,
		),
	);
	router.use("/companies", dependencies.requireAuth, dependencies.requireUser);
	router.use(companyRoutes(dependencies.company));
	return router;
}
