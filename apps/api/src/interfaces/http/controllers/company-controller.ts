import type { Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import * as v from "valibot";
import type { MediaUploadSigner } from "../../../application/ports/media-upload-signer.js";
import type { ChangeMemberRoleUseCase } from "../../../application/use-cases/change-member-role.js";
import type { CreateCompanyUseCase } from "../../../application/use-cases/create-company.js";
import type { InviteMemberUseCase } from "../../../application/use-cases/invite-member.js";
import type { LeaveCompanyUseCase } from "../../../application/use-cases/leave-company.js";
import type { ListCompaniesUseCase } from "../../../application/use-cases/list-companies.js";
import type { ListMembersUseCase } from "../../../application/use-cases/list-members.js";
import type { RevokeMembershipUseCase } from "../../../application/use-cases/revoke-membership.js";
import type { User } from "../../../domain/entities/user.js";
import {
	COMPANY_CONTEXT_FORBIDDEN_CODE,
	COMPANY_CONTEXT_FORBIDDEN_MESSAGE,
} from "../../../domain/errors/company-context-forbidden-error.js";
import type { CompanyContext } from "../middlewares/require-company-context.js";
import { createCompanySchema } from "../validators/company-validator.js";
import { inviteMemberSchema } from "../validators/member-invite-validator.js";
import { updateMemberRoleSchema } from "../validators/member-role-validator.js";

/**
 * The membership id in the path is a UUID, validated before it reaches a use
 * case for the same reason `requireCompanyContext` validates the company id: a
 * malformed id is a client mistake (400) and never a lookup that could leak
 * whether a well-formed id exists.
 */
const membershipIdSchema = v.pipe(v.string(), v.uuid());

export interface CompanyControllerDependencies {
	createCompany: CreateCompanyUseCase;
	listCompanies: ListCompaniesUseCase;
	inviteMember: InviteMemberUseCase;
	listMembers: ListMembersUseCase;
	changeMemberRole: ChangeMemberRoleUseCase;
	revokeMember: RevokeMembershipUseCase;
	leaveCompany: LeaveCompanyUseCase;
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
	inviteMember: RequestHandler;
	listMembers: RequestHandler;
	changeMemberRole: RequestHandler;
	revokeMember: RequestHandler;
	leaveCompany: RequestHandler;
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
 *
 * Exported because the product controller is mounted on the same
 * `companyScoped` router and needs the exact same guarantee; a second copy of
 * this accessor would be a second place to forget the check.
 */
export function resolvedCompanyContext(request: Request): CompanyContext {
	const context = request.companyContext;
	if (context === undefined) {
		throw new Error(
			"requireCompanyContext must run before the company-scoped handlers; the route wiring guarantees a resolved context",
		);
	}
	return context;
}

/**
 * Reads the membership id from the path, validated as a UUID. It returns
 * `undefined` for a malformed value so each handler answers the same 400
 * instead of passing an unvalidated string down to a lookup.
 */
function membershipIdOrUndefined(request: Request): string | undefined {
	const parsed = v.safeParse(membershipIdSchema, request.params.membershipId);
	return parsed.success ? parsed.output : undefined;
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
				const input = v.parse(createCompanySchema, request.body);
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

				// The upload parameters are decided by the signer: whatever
				// folder/formats/timestamp the client sends in the body is ignored,
				// so the signed contract is always the server's, never the
				// caller's. The company context supplies the id and the name the
				// folder is built from; it already proved who may ask.
				const signature = dependencies.mediaUploadSigner.createUploadSignature({
					companyId: context.companyId,
					companyName: context.companyName,
				});

				// Never the api secret: the response is exactly the parameters the
				// browser has to send to the provider.
				response.status(StatusCodes.OK).json(signature);
			} catch (error) {
				next(error);
			}
		},
		inviteMember: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const context = resolvedCompanyContext(request);
				const input = v.parse(inviteMemberSchema, request.body);

				// Normalize the email: trim + lowercase. The lowercasing is a
				// persistence invariant (the Membership entity enforces it too),
				// and doing it here ensures the use case receives a canonical value.
				const membership = await dependencies.inviteMember.execute(
					{ email: input.email.trim().toLowerCase(), role: input.role },
					{
						companyId: context.companyId,
						inviterId: user.id,
						inviterRole: context.role,
					},
				);

				response.status(StatusCodes.CREATED).json(membership);
			} catch (error) {
				next(error);
			}
		},
		listMembers: async (request, response, next) => {
			try {
				const context = resolvedCompanyContext(request);

				const members = await dependencies.listMembers.execute({
					companyId: context.companyId,
					actorRole: context.role,
				});

				response.status(StatusCodes.OK).json(members);
			} catch (error) {
				next(error);
			}
		},
		changeMemberRole: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const context = resolvedCompanyContext(request);
				const membershipId = membershipIdOrUndefined(request);

				if (membershipId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid membership id" },
					});
					return;
				}

				const input = v.parse(updateMemberRoleSchema, request.body);

				const membership = await dependencies.changeMemberRole.execute(
					{ membershipId, role: input.role },
					{
						companyId: context.companyId,
						actorId: user.id,
						actorRole: context.role,
					},
				);

				response.status(StatusCodes.OK).json(membership);
			} catch (error) {
				next(error);
			}
		},
		revokeMember: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const context = resolvedCompanyContext(request);
				const membershipId = membershipIdOrUndefined(request);

				if (membershipId === undefined) {
					response.status(StatusCodes.BAD_REQUEST).json({
						error: { message: "Invalid membership id" },
					});
					return;
				}

				const membership = await dependencies.revokeMember.execute(
					{ membershipId },
					{
						companyId: context.companyId,
						actorId: user.id,
						actorRole: context.role,
					},
				);

				response.status(StatusCodes.OK).json(membership);
			} catch (error) {
				next(error);
			}
		},
		leaveCompany: async (request, response, next) => {
			try {
				const user = resolvedUser(request);
				const context = resolvedCompanyContext(request);

				// The membership is resolved from the caller inside the use case:
				// there is no id in the path, so this route can only revoke the
				// caller's own access.
				const membership = await dependencies.leaveCompany.execute({
					companyId: context.companyId,
					actorId: user.id,
					actorRole: context.role,
				});

				response.status(StatusCodes.OK).json(membership);
			} catch (error) {
				next(error);
			}
		},
		requireCompanyContext: dependencies.requireCompanyContext,
	};
}
