import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { CreateCompanyUseCase } from "../../application/use-cases/create-company.js";
import type { ListCompaniesUseCase } from "../../application/use-cases/list-companies.js";
import type { LoginWithCredentialsUseCase } from "../../application/use-cases/login-with-credentials.js";
import type { RefreshSessionUseCase } from "../../application/use-cases/refresh-session.js";
import type { RegisterUserUseCase } from "../../application/use-cases/register-user.js";
import {
	type AuthCookieOptions,
	createAuthController,
} from "./controllers/auth-controller.js";
import { createCompanyController } from "./controllers/company-controller.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { apiRateLimiter } from "./middlewares/rate-limit.js";
import { buildRoutes } from "./routes/index.js";

export interface AppDependencies {
	createCompany: CreateCompanyUseCase;
	listCompanies: ListCompaniesUseCase;
	loginWithCredentials: LoginWithCredentialsUseCase;
	registerUser: RegisterUserUseCase;
	refreshSession: RefreshSessionUseCase;
	requireAuth: RequestHandler;
	requireUser: RequestHandler;
	authCookieOptions: AuthCookieOptions;
	/**
	 * Browser origin allowed to call the API. It has to be an explicit origin
	 * and not a wildcard: the API sets the refresh-token cookie, and browsers
	 * reject `Access-Control-Allow-Origin: *` on credentialed requests.
	 */
	corsOrigin: string;
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
	app.use(
		cors({
			// Echo the origin only when it is the configured one. Passing the
			// string directly would advertise the allowed origin to every caller;
			// the browser blocks a foreign origin either way, but answering only
			// the intended one keeps the intent explicit and the logs honest.
			origin: (origin, callback) =>
				callback(null, origin === dependencies.corsOrigin),
			credentials: true,
		}),
	);
	app.use(morgan("dev"));
	app.use(express.json());
	app.use(cookieParser());
	app.use(apiRateLimiter);

	app.use(
		buildRoutes({
			company: createCompanyController(dependencies),
			auth: createAuthController({
				loginWithCredentials: dependencies.loginWithCredentials,
				registerUser: dependencies.registerUser,
				refreshSession: dependencies.refreshSession,
				cookieOptions: dependencies.authCookieOptions,
			}),
			requireAuth: dependencies.requireAuth,
			requireUser: dependencies.requireUser,
		}),
	);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
