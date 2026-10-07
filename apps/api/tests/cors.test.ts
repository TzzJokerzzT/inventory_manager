import request from "supertest";
import type { LoginWithCredentialsUseCase } from "../src/application/use-cases/login-with-credentials.js";
import { buildApp } from "../src/interfaces/http/app.js";
import type { AuthCookieOptions } from "../src/interfaces/http/controllers/auth-controller.js";

/**
 * The allowed browser origin. The API sends the refresh-token cookie, and a
 * browser refuses `Access-Control-Allow-Origin: *` on a credentialed request,
 * so this origin has to be echoed back explicitly.
 */
const ALLOWED_ORIGIN = "http://localhost:3000";
const FOREIGN_ORIGIN = "http://not-our-app.test";

const cookieOptions: AuthCookieOptions = {
	httpOnly: true,
	secure: false,
	sameSite: "lax",
	path: "/auth",
	maxAge: 1000,
};

/**
 * Only the CORS layer matters here, so the auth pieces are inert: the
 * passthrough never rejects and the login use case is never called.
 */
function createTestApp() {
	return buildApp({
		createCompany: {} as never,
		listCompanies: {} as never,
		loginWithCredentials: {} as unknown as LoginWithCredentialsUseCase,
		requireAuth: (_request, _response, next) => next(),
		requireUser: (_request, _response, next) => next(),
		authCookieOptions: cookieOptions,
		corsOrigin: ALLOWED_ORIGIN,
	});
}

describe("CORS with credentials", () => {
	it("echoes the allowed origin and allows credentials", async () => {
		const response = await request(createTestApp())
			.get("/health")
			.set("Origin", ALLOWED_ORIGIN);

		expect(response.headers["access-control-allow-origin"]).toBe(
			ALLOWED_ORIGIN,
		);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
	});

	it("does not grant a foreign origin", async () => {
		const response = await request(createTestApp())
			.get("/health")
			.set("Origin", FOREIGN_ORIGIN);

		expect(response.headers["access-control-allow-origin"]).toBeUndefined();
	});

	it("answers the preflight for the login route", async () => {
		const response = await request(createTestApp())
			.options("/auth/login")
			.set("Origin", ALLOWED_ORIGIN)
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "content-type");

		expect(response.status).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe(
			ALLOWED_ORIGIN,
		);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
		expect(response.headers["access-control-allow-methods"]).toContain("POST");
	});
});
