import { Router } from "express";
import type { CompanyController } from "../controllers/company-controller.js";

export function companyRoutes(controller: CompanyController): Router {
	const router = Router();
	router.post("/companies", controller.create);
	router.get("/companies", controller.list);
	return router;
}
