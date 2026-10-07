import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { parse } from "valibot";
import type { CreateCompanyUseCase } from "../../../application/use-cases/create-company.js";
import type { ListCompaniesUseCase } from "../../../application/use-cases/list-companies.js";
import type { User } from "../../../domain/entities/user.js";
import { createCompanySchema } from "../validators/company-validator.js";

export interface CompanyControllerDependencies {
	createCompany: CreateCompanyUseCase;
	listCompanies: ListCompaniesUseCase;
}

export interface CompanyController {
	create: RequestHandler;
	list: RequestHandler;
}

/**
 * The resolved user the company routes are guaranteed to have: `requireUser`
 * runs before this controller, so a missing user is a programming error and
 * not something to work around by inventing one.
 */
function resolvedUser(request: Request): User {
	const user = request.user;
	if (user === undefined) {
		throw new Error(
			"requireUser must run before the company controller; the route wiring guarantees a resolved user",
		);
	}
	return user;
}

/**
 * HTTP adapter for the company use cases.
 *
 * The persistence adapter is chosen in the composition root: Prisma in
 * production, the in-memory adapter in the test suite. This controller only
 * speaks to the use cases and the resolved user.
 */
export function createCompanyController(
	dependencies: CompanyControllerDependencies,
): CompanyController {
	return {
		create: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const input = parse(createCompanySchema, request.body);
				const company = await dependencies.createCompany.execute(input, {
					userId: user.id,
					email: user.email,
				});
				response.status(StatusCodes.CREATED).json(company);
			} catch (error) {
				next(error);
			}
		},
		list: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const companies = await dependencies.listCompanies.execute(user.id);
				response.status(StatusCodes.OK).json(companies);
			} catch (error) {
				next(error);
			}
		},
	};
}
