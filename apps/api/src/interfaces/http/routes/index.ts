import { type RequestHandler, Router } from "express";
import type { AuthController } from "../controllers/auth-controller.js";
import type { CategoryController } from "../controllers/category-controller.js";
import type { CompanyController } from "../controllers/company-controller.js";
import type { CustomerController } from "../controllers/customer-controller.js";
import type { MeController } from "../controllers/me-controller.js";
import type { ProductController } from "../controllers/product-controller.js";
import type { LotController } from "../controllers/stock-lot-controller.js";
import type { StockMovementController } from "../controllers/stock-movement-controller.js";
import type { SupplierController } from "../controllers/supplier-controller.js";
import { authRoutes } from "./auth-routes.js";
import { companyRoutes } from "./company-routes.js";
import { healthRoutes } from "./health-routes.js";
import { meRoutes } from "./me-routes.js";

export interface HttpRoutesDependencies {
	company: CompanyController;
	products: ProductController;
	customers: CustomerController;
	movements: StockMovementController;
	suppliers: SupplierController;
	categories: CategoryController;
	lots: LotController;
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
	router.use(
		companyRoutes(
			dependencies.company,
			dependencies.products,
			dependencies.customers,
			dependencies.movements,
			dependencies.suppliers,
			dependencies.categories,
			dependencies.lots,
		),
	);
	return router;
}
