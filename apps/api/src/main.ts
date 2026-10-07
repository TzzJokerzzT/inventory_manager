import { CreateCompanyUseCase } from "./application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "./application/use-cases/list-companies.js";
import { LoginWithCredentialsUseCase } from "./application/use-cases/login-with-credentials.js";
import { env } from "./config/env.js";
import { Auth0IdentityProvider } from "./infrastructure/auth0/auth0-identity-provider.js";
import { createPrismaClient } from "./infrastructure/database/prisma-client.js";
import { PrismaCompanyRepository } from "./infrastructure/database/prisma-company-repository.js";
import { buildApp } from "./interfaces/http/app.js";
import {
	type AuthCookieOptions,
	REFRESH_TOKEN_MAX_AGE_MS,
} from "./interfaces/http/controllers/auth-controller.js";
import { createRequireAuth } from "./interfaces/http/middlewares/require-auth.js";

// Composition root: the only place where concrete implementations are chosen.
// Production wires the Prisma adapter over the Supabase pooler; the in-memory
// adapter stays available for the test suite, which injects it directly.
const prisma = createPrismaClient();
const companyRepository = new PrismaCompanyRepository({ prisma });

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
	createCompany: new CreateCompanyUseCase({ companyRepository }),
	listCompanies: new ListCompaniesUseCase({ companyRepository }),
	loginWithCredentials: new LoginWithCredentialsUseCase({ identityProvider }),
	requireAuth: createRequireAuth({
		issuerBaseURL: `https://${domain}/`,
		audience,
	}),
	authCookieOptions,
	corsOrigin,
});

app.listen(env.port, () => {
	console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
