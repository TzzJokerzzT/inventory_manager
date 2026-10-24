import { Router } from "express";
import type { CompanyController } from "../controllers/company-controller.js";
import type { CustomerController } from "../controllers/customer-controller.js";
import type { ProductController } from "../controllers/product-controller.js";
import type { LotController } from "../controllers/stock-lot-controller.js";
import type { StockMovementController } from "../controllers/stock-movement-controller.js";
import type { SupplierController } from "../controllers/supplier-controller.js";

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
	customers: CustomerController,
	movements: StockMovementController,
	suppliers: SupplierController,
	lots: LotController,
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
	// The concrete units of a product are a read of its purchase lots, so they hang
	// off the product they belong to (L23). It is registered before
	// `/products/:productId` for the same reason the longer delete path is: the
	// longer path first keeps it obvious that the plain detail route can never
	// swallow it. Any ACTIVE membership reads it, like the rest of the catalogue.
	companyScoped.get("/products/:productId/units", products.units);
	companyScoped.get("/products/:productId", products.get);
	companyScoped.patch("/products/:productId", products.update);
	// The permanent delete is declared BEFORE `/products/:productId` on purpose:
	// Express matches one path segment per parameter, so the plain DELETE can
	// never swallow `/permanent`, but registering the longer path first keeps
	// that fact obvious and is what a future wildcard would break.
	companyScoped.delete("/products/:productId/permanent", products.purge);
	companyScoped.delete("/products/:productId", products.remove);
	// Restoring is the mirror of the delete and shares its permission, so it is
	// a POST on the product it acts on -- a state transition, not a PATCH of a
	// client-owned field.
	companyScoped.post("/products/:productId/restore", products.restore);
	// Customer routes. Same protected sub-router, same reasoning: the company
	// comes from the path and the membership, never from the body. Who may
	// write is "any ACTIVE membership" (S6), so there is no role check here nor
	// in the use cases.
	companyScoped.get("/customers", customers.list);
	companyScoped.post("/customers", customers.create);
	companyScoped.get("/customers/:customerId", customers.get);
	companyScoped.patch("/customers/:customerId", customers.update);
	companyScoped.delete("/customers/:customerId", customers.remove);
	// Supplier routes. Same protected sub-router, same reasoning: the company
	// comes from the path and the membership, never from the body. The ABM of S4
	// is a write of the company catalogue, so `manage_products` decides who may
	// create, edit and soft-delete it (OWNER and ADMIN write, MEMBER reads) --
	// enforced by the use cases, not here. There is no restore route: the scope
	// asks for a baja lógica, and a supplier is referenced by the purchase lots,
	// so the row stays.
	companyScoped.get("/suppliers", suppliers.list);
	companyScoped.post("/suppliers", suppliers.create);
	companyScoped.patch("/suppliers/:supplierId", suppliers.update);
	companyScoped.delete("/suppliers/:supplierId", suppliers.remove);
	// Purchase lot routes. Registering a lot is the way measured stock enters the
	// company (S6): it is a catalogue write (`manage_products`, enforced by the
	// use case) and it shares the protected sub-router, so the company comes from
	// the path and the membership, never from the body. There is no edit nor
	// delete route on purpose -- a lot is the trace of a purchase, and its stock
	// only moves through the ledger.
	companyScoped.post("/lots", lots.create);
	// Stock movement routes. They share the protected sub-router, so they
	// inherit `requireCompanyContext`: any ACTIVE membership registers and reads
	// (S6), and the company comes from the path, never from the body. There is
	// no edit or delete route on purpose -- a movement is the audit trail of the
	// stock (MOV-05).
	companyScoped.get("/movements", movements.list);
	companyScoped.post("/movements", movements.create);
	// Dashboard report routes. The trend is a read of the same ledger, so it
	// hangs off the same protected sub-router and inherits
	// `requireCompanyContext`: any ACTIVE membership reads it (S6) and the
	// company comes from the path, never from the query.
	companyScoped.get("/reports/movements", movements.trend);
	router.use("/companies/:companyId", companyScoped);

	return router;
}
