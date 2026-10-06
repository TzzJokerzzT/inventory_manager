import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { parse } from "valibot";
import type { CreateCompanyUseCase } from "../../../application/use-cases/create-company.js";
import type { ListCompaniesUseCase } from "../../../application/use-cases/list-companies.js";
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
 * HTTP adapter for the company use cases.
 *
 * Note: this is a vertical skeleton. The real persistence (Prisma) is a separate
 * pending task; here the in-memory adapter is what backs the slice.
 */
export function createCompanyController(
	dependencies: CompanyControllerDependencies,
): CompanyController {
	return {
		create: async (request, response, next) => {
			try {
				const input = parse(createCompanySchema, request.body);
				const company = await dependencies.createCompany.execute(input);
				response.status(StatusCodes.CREATED).json(company);
			} catch (error) {
				next(error);
			}
		},
		list: async (_request, response, next) => {
			try {
				const companies = await dependencies.listCompanies.execute();
				response.status(StatusCodes.OK).json(companies);
			} catch (error) {
				next(error);
			}
		},
	};
}
