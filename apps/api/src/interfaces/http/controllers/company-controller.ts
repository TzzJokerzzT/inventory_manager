import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { parse } from "valibot";
import type { MediaUploadSigner } from "../../../application/ports/media-upload-signer.js";
import type { CreateCompanyUseCase } from "../../../application/use-cases/create-company.js";
import type { ListCompaniesUseCase } from "../../../application/use-cases/list-companies.js";
import type { User } from "../../../domain/entities/user.js";
import {
	COMPANY_CONTEXT_FORBIDDEN_CODE,
	COMPANY_CONTEXT_FORBIDDEN_MESSAGE,
} from "../../../domain/errors/company-context-forbidden-error.js";
import type { CompanyContext } from "../middlewares/require-company-context.js";
import { createCompanySchema } from "../validators/company-validator.js";

export interface CompanyControllerDependencies {
	createCompany: CreateCompanyUseCase;
	listCompanies: ListCompaniesUseCase;
	/** Mounted on `/companies/:companyId/*` ahead of the context handler. */
	requireCompanyContext: RequestHandler;
	/** Signs the server-decided upload parameters for a company. */
	mediaUploadSigner: MediaUploadSigner;
}

export interface CompanyController {
	create: RequestHandler;
	list: RequestHandler;
	context: RequestHandler;
	mediaSignature: RequestHandler;
	requireCompanyContext: RequestHandler;
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
 * The resolved company context a company-scoped handler is guaranteed to have:
 * `requireCompanyContext` runs before it, so a missing context is a
 * programming error, not a forbidden access to manufacture.
 */
function resolvedCompanyContext(request: Request): CompanyContext {
	const context = request.companyContext;
	if (context === undefined) {
		throw new Error(
			"requireCompanyContext must run before the company-scoped handlers; the route wiring guarantees a resolved context",
		);
	}
	return context;
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
		context: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const context = resolvedCompanyContext(request);

				const companies = await dependencies.listCompanies.execute(user.id);
				const company = companies.find(
					(candidate) => candidate.id === context.companyId,
				);

				if (company === undefined) {
					// Fail closed: `requireCompanyContext` already proved an ACTIVE
					// membership, and the company list reads the same membership
					// table, so this branch is unreachable in a consistent store.
					// If they disagree, answer the same uniform 403 rather than a
					// half-built payload.
					response.status(StatusCodes.FORBIDDEN).json({
						error: {
							message: COMPANY_CONTEXT_FORBIDDEN_MESSAGE,
							code: COMPANY_CONTEXT_FORBIDDEN_CODE,
						},
					});
					return;
				}

				response.status(StatusCodes.OK).json({ company, role: context.role });
			} catch (error) {
				next(error);
			}
		},
		mediaSignature: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);

				// The upload parameters are decided by the signer from the company
				// id alone: whatever folder/formats/timestamp the client sends in
				// the body is ignored, so the signed contract is always the
				// server's, never the caller's.
				const signature = dependencies.mediaUploadSigner.createUploadSignature({
					companyId: context.companyId,
				});

				// Never the api secret: the response is exactly the parameters the
				// browser has to send to the provider.
				response.status(StatusCodes.OK).json(signature);
			} catch (error) {
				next(error);
			}
		},
		requireCompanyContext: dependencies.requireCompanyContext,
	};
}
