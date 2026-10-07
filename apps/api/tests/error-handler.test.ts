import express from "express";
import request from "supertest";
import { errorHandler } from "../src/interfaces/http/middlewares/error-handler.js";

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
