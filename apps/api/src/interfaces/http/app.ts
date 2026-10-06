import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { CreateCompanyUseCase } from "../../application/use-cases/create-company.js";
import type { ListCompaniesUseCase } from "../../application/use-cases/list-companies.js";
import { createCompanyController } from "./controllers/company-controller.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { apiRateLimiter } from "./middlewares/rate-limit.js";
import { buildRoutes } from "./routes/index.js";

export interface AppDependencies {
	createCompany: CreateCompanyUseCase;
	listCompanies: ListCompaniesUseCase;
}

/**
 * Builds the Express app from injected use cases.
 *
 * It deliberately does not call `listen`, so tests can import it with
 * supertest and the composition root (`main.ts`) owns the listener.
 */
export function buildApp(dependencies: AppDependencies): Express {
	const app = express();

	app.use(helmet());
	app.use(cors());
	app.use(morgan("dev"));
	app.use(express.json());
	app.use(cookieParser());
	app.use(apiRateLimiter);

	app.use(buildRoutes({ company: createCompanyController(dependencies) }));

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
