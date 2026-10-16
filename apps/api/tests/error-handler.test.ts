import express from "express";
import request from "supertest";
import { IdentityProviderUnavailableError } from "../src/domain/errors/identity-provider-unavailable-error.js";
import { InvalidCredentialsError } from "../src/domain/errors/invalid-credentials-error.js";
import { errorHandler } from "../src/interfaces/http/middlewares/error-handler.js";

function buildThrowingApp(error: Error) {
	const app = express();
	app.get("/throw", (_request, _response, next) => {
		next(error);
	});
	app.use(errorHandler);
	return app;
}

describe("errorHandler auth error mapping", () => {
	it("maps InvalidCredentialsError to 401 with its fixed message", async () => {
		const response = await request(
			buildThrowingApp(new InvalidCredentialsError()),
		).get("/throw");

		expect(response.status).toBe(401);
		expect(response.body).toEqual({
			error: { message: "Invalid credentials" },
		});
	});

	it("maps IdentityProviderUnavailableError to 503 with its fixed message", async () => {
		const response = await request(
			buildThrowingApp(new IdentityProviderUnavailableError()),
		).get("/throw");

		expect(response.status).toBe(503);
		expect(response.body).toEqual({
			error: { message: "Identity provider unavailable" },
		});
	});
});

describe("errorHandler header allowlist", () => {
	it("does not forward arbitrary headers carried by an error", async () => {
		const app = express();

		// Throwaway route: it only exists to throw an error that carries a
		// header the handler must NOT forward. It never touches production
		// routes.
		app.get("/throw", (_request, _response, next) => {
			const error = Object.assign(new Error("boom"), {
				status: 400,
				headers: { "X-Forwarded-For": "1.2.3.4" },
			});
			next(error);
		});

		app.use(errorHandler);

		const response = await request(app).get("/throw");

		expect(response.status).toBe(400);
		expect(response.headers["x-forwarded-for"]).toBeUndefined();
	});
});
