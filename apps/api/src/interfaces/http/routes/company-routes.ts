import { Router } from "express";
import type { CompanyController } from "../controllers/company-controller.js";
import type { ProductController } from "../controllers/product-controller.js";

/**
 * Company routes.
 *
 * `GET /companies` and `POST /companies` stay unchanged. Everything under
 * `/companies/:companyId` resolves the company context first, so a request can
 * only reach a company-scoped resource after its ACTIVE membership and role are
 * validated. MI-6/MI-7/MI-9 add their per-company routes to the same
 * `companyScoped` router instead of inventing a second path to the membership.
 */
export function companyRoutes(
	controller: CompanyController,
	products: ProductController,
): Router {
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
	// Member management routes. They inherit `requireCompanyContext`, so only
	// users with an ACTIVE membership can reach them. The role-based
	// authorization (who can invite whom) is enforced by the use cases.
	companyScoped.post("/members", controller.inviteMember);
	companyScoped.get("/members", controller.listMembers);
	// `/members/me` is declared BEFORE `/members/:membershipId` on purpose:
	// Express matches in registration order, so the other way round "me" would be
	// captured as a membership id. Leaving is the only member action that does
	// not name a membership, because it never needs one.
	companyScoped.delete("/members/me", controller.leaveCompany);
	companyScoped.patch("/members/:membershipId", controller.changeMemberRole);
	companyScoped.delete("/members/:membershipId", controller.revokeMember);
	// Product routes. They hang off the same protected sub-router, so they
	// inherit `requireCompanyContext`: the company comes from the path and the
	// membership, never from the body. Who may write is decided by the
	// `manage_products` row of the matrix inside the use cases, not here.
	companyScoped.get("/products", products.list);
	companyScoped.post("/products", products.create);
	companyScoped.get("/products/:productId", products.get);
	companyScoped.patch("/products/:productId", products.update);
	companyScoped.delete("/products/:productId", products.remove);
	router.use("/companies/:companyId", companyScoped);

	return router;
}
