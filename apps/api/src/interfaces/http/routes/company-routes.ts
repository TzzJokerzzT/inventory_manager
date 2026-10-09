import { Router } from "express";
import type { CompanyController } from "../controllers/company-controller.js";

/**
 * Company routes.
 *
 * `GET /companies` and `POST /companies` stay unchanged. Everything under
 * `/companies/:companyId` resolves the company context first, so a request can
 * only reach a company-scoped resource after its ACTIVE membership and role are
 * validated. MI-6/MI-7/MI-9 add their per-company routes to the same
 * `companyScoped` router instead of inventing a second path to the membership.
 */
export function companyRoutes(controller: CompanyController): Router {
	const router = Router();
	router.post("/companies", controller.create);
	router.get("/companies", controller.list);

	// `mergeParams` lets the handlers inside read `:companyId` from the parent
	// mount path; the middleware and the controller both consume it.
	const companyScoped = Router({ mergeParams: true });
	companyScoped.use(controller.requireCompanyContext);
	companyScoped.get("/context", controller.context);
	// Signing an upload is a write permission tied to the company, so it hangs
	// off the same protected sub-router as `/context` and inherits
	// `requireCompanyContext`: a non-member can never sign an upload in the
	// company's name.
	companyScoped.post("/media/signature", controller.mediaSignature);
	router.use("/companies/:companyId", companyScoped);

	return router;
}
