import path from "node:path";
import type { RequestHandler, Router } from "express";
import request from "supertest";
import YAML from "yamljs";
import { buildApp } from "../src/interfaces/http/app.js";
import { buildRoutes } from "../src/interfaces/http/routes/index.js";

const TEST_WEB_ORIGIN = "http://localhost:3000";

const noop: RequestHandler = (_request, _response, next) => next();

/**
 * The Express `Router` stack is a private implementation detail, but it is the
 * only honest way to enumerate every registered route. We accept the private
 * API here on purpose: a hand-written allow-list would silently pass when a new
 * route is added, which is exactly the drift this contract exists to prevent.
 */
interface ExpressLayer {
	route?: { path: string; methods: Record<string, boolean> };
	handle?: unknown;
}

interface RegisteredRoute {
	method: string;
	path: string;
}

const HTTP_METHODS = new Set([
	"get",
	"post",
	"put",
	"patch",
	"delete",
	"head",
	"options",
	"trace",
]);

interface SpecOperation {
	method: string;
	path: string;
}

/** Flattens `paths` into one entry per HTTP operation. */
function collectSpecOperations(
	paths: Record<string, Record<string, unknown>>,
): SpecOperation[] {
	const operations: SpecOperation[] = [];
	for (const [specPath, item] of Object.entries(paths)) {
		for (const method of Object.keys(item)) {
			if (HTTP_METHODS.has(method)) {
				operations.push({ method, path: specPath });
			}
		}
	}
	return operations;
}

/**
 * Walks a router and returns one entry per route layer.
 *
 * Express 5 stores a route's path on `layer.route.path`, so route layers are
 * enumerable. A *mount path* (`router.use("/companies/:companyId", subRouter)`)
 * is NOT exposed anywhere on the layer: the router v2 layer sets `layer.path`
 * to `undefined` and keeps the path only inside the `path-to-regexp` matcher
 * closure. Routes registered under a parameterised mount are therefore
 * returned with their local path (`/context`), and the coverage check below
 * reconciles them against the specification by path suffix.
 */
function collectRoutes(router: Router): RegisteredRoute[] {
	const collected: RegisteredRoute[] = [];

	const visit = (stack: unknown[]): void => {
		for (const entry of stack) {
			const layer = entry as ExpressLayer;

			if (layer.route !== undefined) {
				for (const method of Object.keys(layer.route.methods)) {
					if (layer.route.methods[method]) {
						collected.push({
							method: method.toUpperCase(),
							path: layer.route.path,
						});
					}
				}
				continue;
			}

			// A mounted sub-router is a function whose own `stack` carries its
			// layers; plain middleware layers have no `stack` and are skipped.
			const handle = layer.handle as { stack?: unknown } | undefined;
			if (
				typeof layer.handle === "function" &&
				handle !== undefined &&
				Array.isArray(handle.stack)
			) {
				visit(handle.stack);
			}
		}
	};

	visit(router.stack as unknown as unknown[]);
	return collected;
}

/** Express uses `:companyId`; OpenAPI uses `{companyId}`. */
function toOpenApiPath(expressPath: string): string {
	return expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function buildRoutesForEnumeration(): Router {
	return buildRoutes({
		company: {
			create: noop,
			list: noop,
			context: noop,
			mediaSignature: noop,
			requireCompanyContext: noop,
		},
		auth: {
			login: noop,
			register: noop,
			refresh: noop,
			logout: noop,
		},
		requireAuth: noop,
		requireUser: noop,
	});
}

function loadDocumentFromRepository(): Record<string, unknown> {
	const document: unknown = YAML.load(
		path.resolve(__dirname, "../openapi.yaml"),
	);

	if (typeof document !== "object" || document === null) {
		throw new Error(
			`OpenAPI document did not parse to an object: ${path.resolve(__dirname, "../openapi.yaml")}`,
		);
	}

	return document as Record<string, unknown>;
}

function createTestApp() {
	return buildApp({
		createCompany: {} as never,
		listCompanies: {} as never,
		loginWithCredentials: {} as never,
		registerUser: {} as never,
		refreshSession: {} as never,
		mediaUploadSigner: {} as never,
		requireAuth: noop,
		requireUser: noop,
		requireCompanyContext: noop,
		authCookieOptions: {
			httpOnly: true,
			secure: false,
			sameSite: "lax",
			path: "/auth",
			maxAge: 1000,
		},
		corsOrigin: TEST_WEB_ORIGIN,
	});
}

describe("OpenAPI contract", () => {
	it("serves the OpenAPI document as JSON on the documentation route", async () => {
		const response = await request(createTestApp()).get("/docs/openapi.json");

		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toContain("application/json");
		expect(response.body).toMatchObject({ openapi: "3.0.3" });
		expect(response.body.paths).toBeDefined();
	});

	it("serves the Swagger UI on the documentation route", async () => {
		// `swagger-ui-express` mounts its static assets first, so the bare
		// `/docs` answers a 301 to `/docs/` (standard `express.static` directory
		// redirect) and the UI HTML is served at `/docs/`.
		const response = await request(createTestApp()).get("/docs/");

		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toContain("text/html");
	});

	it("covers every route registered in the router", () => {
		const document = loadDocumentFromRepository();
		const paths = (document.paths ?? {}) as Record<
			string,
			Record<string, unknown>
		>;
		const registered = collectRoutes(buildRoutesForEnumeration());

		const missing: string[] = [];
		for (const route of registered) {
			const openApiPath = toOpenApiPath(route.path);
			const covered = Object.entries(paths).some(
				([specPath, operations]) =>
					(specPath === openApiPath || specPath.endsWith(openApiPath)) &&
					operations[route.method.toLowerCase()] !== undefined,
			);

			if (!covered) {
				missing.push(`${route.method} ${route.path} (expected ${openApiPath})`);
			}
		}

		expect(missing).toEqual([]);

		// Same count in both directions: every router route has a spec operation
		// and the spec documents no operation the router does not register.
		expect(registered).toHaveLength(collectSpecOperations(paths).length);
	});
});
