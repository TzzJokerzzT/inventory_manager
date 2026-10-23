import type { ErrorRequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { ValiError } from "valibot";
import {
	CUSTOMER_NOT_FOUND_CODE,
	CustomerNotFoundError,
} from "../../../domain/errors/customer-not-found-error.js";
import {
	CUSTOMER_REQUIRES_EXIT_CODE,
	CustomerRequiresExitError,
} from "../../../domain/errors/customer-requires-exit-error.js";
import { DomainError } from "../../../domain/errors/domain-error.js";
import { EmailNotVerifiedError } from "../../../domain/errors/email-not-verified-error.js";
import { IdentityProviderUnavailableError } from "../../../domain/errors/identity-provider-unavailable-error.js";
import {
	INSUFFICIENT_ROLE_CODE,
	InsufficientRoleError,
} from "../../../domain/errors/insufficient-role-error.js";
import {
	INSUFFICIENT_STOCK_CODE,
	InsufficientStockError,
} from "../../../domain/errors/insufficient-stock-error.js";
import { InvalidCredentialsError } from "../../../domain/errors/invalid-credentials-error.js";
import {
	LAST_ACTIVE_OWNER_CODE,
	LastActiveOwnerError,
} from "../../../domain/errors/last-active-owner-error.js";
import {
	MEMBERSHIP_ALREADY_EXISTS_CODE,
	MembershipAlreadyExistsError,
} from "../../../domain/errors/membership-already-exists-error.js";
import {
	MEMBERSHIP_NOT_FOUND_CODE,
	MembershipNotFoundError,
} from "../../../domain/errors/membership-not-found-error.js";
import {
	PRODUCT_NOT_DELETED_CODE,
	ProductNotDeletedError,
} from "../../../domain/errors/product-not-deleted-error.js";
import {
	PRODUCT_NOT_FOUND_CODE,
	ProductNotFoundError,
} from "../../../domain/errors/product-not-found-error.js";
import {
	SKU_ALREADY_EXISTS_CODE,
	SkuAlreadyExistsError,
} from "../../../domain/errors/sku-already-exists-error.js";
import { UserNotProvisionedError } from "../../../domain/errors/user-not-provisioned-error.js";

function getHttpStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const candidate =
		(error as { status?: unknown }).status ??
		(error as { statusCode?: unknown }).statusCode;

	return typeof candidate === "number" ? candidate : undefined;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return "Request failed";
}

/**
 * RFC 6750 expects a `WWW-Authenticate` challenge on 401 responses, and
 * `express-oauth2-jwt-bearer` stores it on the error it throws. Forward only
 * this one header by name: errors are reachable from untrusted input in other
 * code paths, so a generic `response.set(error.headers)` would turn any future
 * error that carries a `headers` property into a header-injection vector.
 */
function getWwwAuthenticateHeader(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const headers = (error as { headers?: unknown }).headers;
	if (typeof headers !== "object" || headers === null) {
		return undefined;
	}

	const value = (headers as Record<string, unknown>)["WWW-Authenticate"];
	return typeof value === "string" ? value : undefined;
}

/**
 * Last middleware in the chain. It maps known error kinds to HTTP statuses and
 * hides unexpected errors behind a generic 500.
 */
export const errorHandler: ErrorRequestHandler = (
	error,
	_request,
	response,
	_next,
) => {
	if (error instanceof DomainError) {
		response.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
			error: { message: error.message },
		});
		return;
	}

	if (error instanceof ValiError) {
		response.status(StatusCodes.BAD_REQUEST).json({
			error: {
				message: "Invalid request body",
				issues: error.issues.map((issue) => issue.message),
			},
		});
		return;
	}

	if (error instanceof InsufficientRoleError) {
		// The caller is a member (the company context resolved), so this 403 is
		// safe to discriminate: it says "your role cannot do this", not "you are
		// not a member". The code is what lets the client tell them apart.
		response.status(StatusCodes.FORBIDDEN).json({
			error: { message: error.message, code: INSUFFICIENT_ROLE_CODE },
		});
		return;
	}

	if (error instanceof InsufficientStockError) {
		// 409, not 400: the body is well formed and the caller may register the
		// movement, the product simply does not have that much stock. Nothing was
		// recorded and the stock did not change (MOV-04).
		response.status(StatusCodes.CONFLICT).json({
			error: { message: error.message, code: INSUFFICIENT_STOCK_CODE },
		});
		return;
	}

	if (error instanceof MembershipAlreadyExistsError) {
		response.status(StatusCodes.CONFLICT).json({
			error: { message: error.message, code: MEMBERSHIP_ALREADY_EXISTS_CODE },
		});
		return;
	}

	if (error instanceof LastActiveOwnerError) {
		// 409, not 403: the caller may well be allowed to manage members, but the
		// result would break the "every company keeps an active OWNER"
		// invariant (§5.8, invariant 4). A distinct code so the UI can explain
		// that the company would be left ownerless instead of blaming a role.
		response.status(StatusCodes.CONFLICT).json({
			error: { message: error.message, code: LAST_ACTIVE_OWNER_CODE },
		});
		return;
	}

	if (error instanceof MembershipNotFoundError) {
		response.status(StatusCodes.NOT_FOUND).json({
			error: { message: error.message, code: MEMBERSHIP_NOT_FOUND_CODE },
		});
		return;
	}

	if (error instanceof ProductNotFoundError) {
		// The same 404 a foreign id and an absent one get: the product is not in
		// this company's catalogue, and which of the two it was is not something
		// the caller needs to know (S4).
		response.status(StatusCodes.NOT_FOUND).json({
			error: { message: error.message, code: PRODUCT_NOT_FOUND_CODE },
		});
		return;
	}

	if (error instanceof ProductNotDeletedError) {
		// 409, not 404 and not a silent no-op: the product exists in this
		// company, it is simply not in the trash, so there is nothing to
		// restore (L2). The code tells the client that its copy of the state was
		// stale, instead of letting it believe the restore happened.
		response.status(StatusCodes.CONFLICT).json({
			error: {
				message: error.message,
				code: PRODUCT_NOT_DELETED_CODE,
			},
		});
		return;
	}

	if (error instanceof CustomerNotFoundError) {
		// The same 404 a foreign id and an absent one get: the customer is not in
		// this company's roster, and which of the two it was is not something the
		// caller needs to know (S5).
		response.status(StatusCodes.NOT_FOUND).json({
			error: { message: error.message, code: CUSTOMER_NOT_FOUND_CODE },
		});
		return;
	}

	if (error instanceof CustomerRequiresExitError) {
		// 400, not 409: the body is semantically invalid -- a customer belongs to
		// a sale (CLI-04) and an entry is a purchase from a supplier. The code is
		// what lets the client point at the `customerId` field.
		response.status(StatusCodes.BAD_REQUEST).json({
			error: { message: error.message, code: CUSTOMER_REQUIRES_EXIT_CODE },
		});
		return;
	}

	if (error instanceof SkuAlreadyExistsError) {
		// 409, not 400: the body is well formed, the company just already has
		// that SKU -- deleted rows included, because they keep it reserved (S2).
		response.status(StatusCodes.CONFLICT).json({
			error: { message: error.message, code: SKU_ALREADY_EXISTS_CODE },
		});
		return;
	}

	if (error instanceof InvalidCredentialsError) {
		response.status(StatusCodes.UNAUTHORIZED).json({
			error: { message: error.message },
		});
		return;
	}

	if (error instanceof IdentityProviderUnavailableError) {
		response.status(StatusCodes.SERVICE_UNAVAILABLE).json({
			error: { message: error.message },
		});
		return;
	}

	if (error instanceof EmailNotVerifiedError) {
		// The `code` is what lets the web client distinguish this 403 from any
		// other. The fixed message is the human-facing text; the code is the
		// machine-readable discriminator.
		response.status(StatusCodes.FORBIDDEN).json({
			error: { message: error.message, code: "email_not_verified" },
		});
		return;
	}

	if (error instanceof UserNotProvisionedError) {
		// Same pattern as `email_not_verified`: the fixed message is for humans,
		// the `code` is the discriminator the client keys on.
		response.status(StatusCodes.FORBIDDEN).json({
			error: { message: error.message, code: "user_not_provisioned" },
		});
		return;
	}

	const status = getHttpStatus(error);
	if (status !== undefined) {
		const wwwAuthenticate = getWwwAuthenticateHeader(error);
		if (wwwAuthenticate !== undefined) {
			response.setHeader("WWW-Authenticate", wwwAuthenticate);
		}

		response
			.status(status)
			.json({ error: { message: getErrorMessage(error) } });
		return;
	}

	response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
		error: { message: "Internal server error" },
	});
};
