import { v2 as cloudinary } from "cloudinary";
import { AcceptInvitationsUseCase } from "./application/use-cases/accept-invitations.js";
import { ChangeMemberRoleUseCase } from "./application/use-cases/change-member-role.js";
import { CreateCompanyUseCase } from "./application/use-cases/create-company.js";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.js";
import { CreateProductUseCase } from "./application/use-cases/create-product.js";
import { DeleteCustomerUseCase } from "./application/use-cases/delete-customer.js";
import { DeleteProductUseCase } from "./application/use-cases/delete-product.js";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.js";
import { GetCustomerUseCase } from "./application/use-cases/get-customer.js";
import { GetMovementTrendUseCase } from "./application/use-cases/get-movement-trend.js";
import { GetProductUseCase } from "./application/use-cases/get-product.js";
import { InviteMemberUseCase } from "./application/use-cases/invite-member.js";
import { LeaveCompanyUseCase } from "./application/use-cases/leave-company.js";
import { ListCompaniesUseCase } from "./application/use-cases/list-companies.js";
import { ListCustomersUseCase } from "./application/use-cases/list-customers.js";
import { ListMembersUseCase } from "./application/use-cases/list-members.js";
import { ListNotificationsUseCase } from "./application/use-cases/list-notifications.js";
import { ListPendingInvitationsUseCase } from "./application/use-cases/list-pending-invitations.js";
import { ListProductsUseCase } from "./application/use-cases/list-products.js";
import { ListStockMovementsUseCase } from "./application/use-cases/list-stock-movements.js";
import { LoginWithCredentialsUseCase } from "./application/use-cases/login-with-credentials.js";
import { MarkNotificationsReadUseCase } from "./application/use-cases/mark-notifications-read.js";
import { PurgeProductUseCase } from "./application/use-cases/purge-product.js";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.js";
import { RegisterStockMovementUseCase } from "./application/use-cases/register-stock-movement.js";
import { RegisterUserUseCase } from "./application/use-cases/register-user.js";
import { RestoreProductUseCase } from "./application/use-cases/restore-product.js";
import { RevokeMembershipUseCase } from "./application/use-cases/revoke-membership.js";
import { UpdateCustomerUseCase } from "./application/use-cases/update-customer.js";
import { UpdateProductUseCase } from "./application/use-cases/update-product.js";
import { UpdateUserFullNameUseCase } from "./application/use-cases/update-user-full-name.js";
import { env } from "./config/env.js";
import { Auth0IdentityProvider } from "./infrastructure/auth0/auth0-identity-provider.js";
import { createPrismaClient } from "./infrastructure/database/prisma-client.js";
import { PrismaCompanyRepository } from "./infrastructure/database/prisma-company-repository.js";
import { PrismaCustomerRepository } from "./infrastructure/database/prisma-customer-repository.js";
import { PrismaMembershipRepository } from "./infrastructure/database/prisma-membership-repository.js";
import { PrismaNotificationRepository } from "./infrastructure/database/prisma-notification-repository.js";
import { PrismaProductRepository } from "./infrastructure/database/prisma-product-repository.js";
import { PrismaStockMovementRepository } from "./infrastructure/database/prisma-stock-movement-repository.js";
import { PrismaUserRepository } from "./infrastructure/database/prisma-user-repository.js";
import { CloudinaryUploadSigner } from "./infrastructure/storage/cloudinary-upload-signer.js";
import { buildApp } from "./interfaces/http/app.js";
import {
	type AuthCookieOptions,
	REFRESH_TOKEN_MAX_AGE_MS,
} from "./interfaces/http/controllers/auth-controller.js";
import { createRequireAuth } from "./interfaces/http/middlewares/require-auth.js";
import { createRequireCompanyContext } from "./interfaces/http/middlewares/require-company-context.js";
import { createRequireUser } from "./interfaces/http/middlewares/require-user.js";

// Composition root: the only place where concrete implementations are chosen.
// Production wires the Prisma adapter over the Supabase pooler; the in-memory
// adapter stays available for the test suite, which injects it directly.
const prisma = createPrismaClient();
const companyRepository = new PrismaCompanyRepository({ prisma });
const userRepository = new PrismaUserRepository({ prisma });
const membershipRepository = new PrismaMembershipRepository({ prisma });
const notificationRepository = new PrismaNotificationRepository({ prisma });
const productRepository = new PrismaProductRepository({ prisma });
const customerRepository = new PrismaCustomerRepository({ prisma });
const stockMovementRepository = new PrismaStockMovementRepository({ prisma });

// `env.auth0` values are optional outside production (see `config/env.ts`),
// but both the login endpoint and the protected routes cannot work without
// them, so fail fast with the variable names and never the values.
const { domain, audience, clientId, clientSecret, connection } = env.auth0;
if (!domain || !audience || !clientId || !clientSecret || !connection) {
	throw new Error(
		"Missing required environment variables: AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET and AUTH0_CONNECTION",
	);
}

const identityProvider = new Auth0IdentityProvider({
	issuerBaseURL: `https://${domain}/`,
	clientId,
	clientSecret,
	audience,
	connection,
});

// Cloudinary credentials are optional outside production (see `config/env.ts`),
// but the signature endpoint cannot work without them, so fail fast with the
// variable names and never the values.
const { cloudName, apiKey, apiSecret } = env.cloudinary;
if (!cloudName || !apiKey || !apiSecret) {
	throw new Error(
		"Missing required environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET",
	);
}

// The real signing function is bound here, in the composition root: the
// adapter stays pure and the test suite injects a fake so no test ever calls
// the real Cloudinary account.
const mediaUploadSigner = new CloudinaryUploadSigner({
	cloudName,
	apiKey,
	apiSecret,
	sign: (paramsToSign, secret) =>
		cloudinary.utils.api_sign_request(paramsToSign, secret),
});

// The refresh cookie is `Secure` only in production, so the same app can run
// locally (and be tested) over plain HTTP.
const authCookieOptions: AuthCookieOptions = {
	httpOnly: true,
	secure: env.nodeEnv === "production",
	sameSite: "lax",
	path: "/auth",
	maxAge: REFRESH_TOKEN_MAX_AGE_MS,
};

// The browser origin that may call the API with credentials. `env.ts` makes it
// required in production; the development fallback keeps the local app working
// against the Next.js dev server without extra setup.
const corsOrigin = env.webOrigin ?? "http://localhost:3000";

const app = buildApp({
	acceptInvitations: new AcceptInvitationsUseCase({
		membershipRepository,
		notificationRepository,
	}),
	changeMemberRole: new ChangeMemberRoleUseCase({ membershipRepository }),
	createCompany: new CreateCompanyUseCase({ companyRepository }),
	getCurrentUser: new GetCurrentUserUseCase({
		companyRepository,
		membershipRepository,
	}),
	inviteMember: new InviteMemberUseCase({ membershipRepository }),
	leaveCompany: new LeaveCompanyUseCase({ membershipRepository }),
	listMembers: new ListMembersUseCase({ membershipRepository }),
	listNotifications: new ListNotificationsUseCase({
		companyRepository,
		notificationRepository,
		userRepository,
	}),
	listPendingInvitations: new ListPendingInvitationsUseCase({
		companyRepository,
		membershipRepository,
		userRepository,
	}),
	markNotificationsRead: new MarkNotificationsReadUseCase({
		notificationRepository,
	}),
	revokeMember: new RevokeMembershipUseCase({ membershipRepository }),
	listCompanies: new ListCompaniesUseCase({ companyRepository }),
	loginWithCredentials: new LoginWithCredentialsUseCase({
		identityProvider,
		userRepository,
	}),
	registerUser: new RegisterUserUseCase({ identityProvider }),
	refreshSession: new RefreshSessionUseCase({ identityProvider }),
	updateUserFullName: new UpdateUserFullNameUseCase({ userRepository }),
	requireAuth: createRequireAuth({
		issuerBaseURL: `https://${domain}/`,
		audience,
	}),
	requireUser: createRequireUser({ userRepository }),
	requireCompanyContext: createRequireCompanyContext({
		membershipRepository,
		companyRepository,
	}),
	products: {
		list: new ListProductsUseCase({ productRepository }),
		create: new CreateProductUseCase({ productRepository }),
		get: new GetProductUseCase({ productRepository }),
		update: new UpdateProductUseCase({ productRepository }),
		remove: new DeleteProductUseCase({ productRepository }),
		restore: new RestoreProductUseCase({ productRepository }),
		// The purge needs the ledger to count the movements that block it (S4):
		// the row is never removed while the audit trail points at it (MOV-05).
		purge: new PurgeProductUseCase({
			productRepository,
			stockMovementRepository,
		}),
	},
	customers: {
		list: new ListCustomersUseCase({ customerRepository }),
		create: new CreateCustomerUseCase({ customerRepository }),
		get: new GetCustomerUseCase({ customerRepository }),
		update: new UpdateCustomerUseCase({ customerRepository }),
		remove: new DeleteCustomerUseCase({ customerRepository }),
	},
	movements: {
		register: new RegisterStockMovementUseCase({
			productRepository,
			stockMovementRepository,
			customerRepository,
		}),
		list: new ListStockMovementsUseCase({
			stockMovementRepository,
			productRepository,
			userRepository,
			customerRepository,
		}),
		// No clock is injected in production: the trend ends on today's UTC day.
		trend: new GetMovementTrendUseCase({ stockMovementRepository }),
	},
	mediaUploadSigner,
	authCookieOptions,
	corsOrigin,
});

app.listen(env.port, () => {
	console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
