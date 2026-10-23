import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { MembershipRole } from "../../../domain/entities/membership.js";
import {
	COMPANY_CONTEXT_FORBIDDEN_CODE,
	COMPANY_CONTEXT_FORBIDDEN_MESSAGE,
} from "../../../domain/errors/company-context-forbidden-error.js";
import type { CompanyRepository } from "../../../domain/repositories/company-repository.js";
import type { MembershipRepository } from "../../../domain/repositories/membership-repository.js";

export interface CompanyContext {
	companyId: string;
	role: MembershipRole;
	/**
	 * The company's display name, resolved with the same request.
	 *
	 * It lives in the context because some company-scoped flows need the
	 * company itself, not only its id -- the media signature builds one upload
	 * folder per company out of `id` and `name`. Resolving it here keeps those
	 * flows from re-reading the company list and from trusting a client-sent
	 * name.
	 */
	companyName: string;
}

/**
 * Request augmentation, same criterion as `require-user.ts`: the resolved
 * company context is request-scoped identity (the membership the client
 * claims), not response state. `requireCompanyContext` is what populates it,
 * so it stays `undefined` on routes that do not run the middleware.
 */
declare global {
	namespace Express {
		interface Request {
			companyContext?: CompanyContext;
		}
	}
}

export interface RequireCompanyContextDependencies {
	membershipRepository: MembershipRepository;
	companyRepository: CompanyRepository;
}

const companyIdSchema = v.pipe(v.string(), v.uuid());

/**
 * Builds the `requireCompanyContext` middleware, which must run *after*
 * `requireAuth` and `requireUser`.
 *
 * The client does say which company it operates on — `companyId` arrives as a
 * route param — and the server never believes it: it validates an ACTIVE
 * membership on every request and resolves the caller's role. A non-member and
 * a non-existent company are answered with the same uniform 403 so the endpoint
 * cannot be used to enumerate which company ids exist; only a malformed
 * `companyId` is a 400, because that is a client mistake, not a forbidden
 * access.
 *
 * This middleware is mounted on `/companies/:companyId/*` and is the place
 * MI-6/MI-7/MI-9 must hang their per-company resource routes, not invent a new
 * path to the membership.
 */
export function createRequireCompanyContext({
	membershipRepository,
	companyRepository,
}: RequireCompanyContextDependencies): RequestHandler {
	return async (request, response, next) => {
		try {
			const user = request.user;
			if (user === undefined) {
				throw new Error(
					"requireUser must run before requireCompanyContext; the route wiring guarantees a resolved user",
				);
			}

			// Format check runs before any membership lookup, so a malformed id
			// can never leak whether a well-formed id exists.
			const parsed = v.safeParse(companyIdSchema, request.params.companyId);
			if (!parsed.success) {
				response.status(StatusCodes.BAD_REQUEST).json({
					error: { message: "Invalid company id" },
				});
				return;
			}

			const membership = await membershipRepository.findActiveByUserAndCompany(
				user.id,
				parsed.output,
			);
			if (membership === null) {
				// Uniform 403: non-member and non-existent company are
				// indistinguishable on purpose (docs/stack.md §5.8).
				response.status(StatusCodes.FORBIDDEN).json({
					error: {
						message: COMPANY_CONTEXT_FORBIDDEN_MESSAGE,
						code: COMPANY_CONTEXT_FORBIDDEN_CODE,
					},
				});
				return;
			}

			// The membership proves access; the company row supplies the name. A
			// membership pointing at a company that does not exist is an
			// inconsistent store, so it fails closed with the same uniform 403
			// instead of half-building a context.
			const [company] = await companyRepository.findByIds([parsed.output]);
			if (company === undefined) {
				response.status(StatusCodes.FORBIDDEN).json({
					error: {
						message: COMPANY_CONTEXT_FORBIDDEN_MESSAGE,
						code: COMPANY_CONTEXT_FORBIDDEN_CODE,
					},
				});
				return;
			}

			request.companyContext = {
				companyId: parsed.output,
				role: membership.role,
				companyName: company.name,
			};
			next();
		} catch (error) {
			next(error);
		}
	};
}
