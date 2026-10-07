import { CreateCompanyUseCase } from "./application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "./application/use-cases/list-companies.js";
import { env } from "./config/env.js";
import { createPrismaClient } from "./infrastructure/database/prisma-client.js";
import { PrismaCompanyRepository } from "./infrastructure/database/prisma-company-repository.js";
import { buildApp } from "./interfaces/http/app.js";
import { createRequireAuth } from "./interfaces/http/middlewares/require-auth.js";

// Composition root: the only place where concrete implementations are chosen.
// Production wires the Prisma adapter over the Supabase pooler; the in-memory
// adapter stays available for the test suite, which injects it directly.
const prisma = createPrismaClient();
const companyRepository = new PrismaCompanyRepository({ prisma });

// `env.auth0` values are optional outside production (see `config/env.ts`),
// but the protected routes cannot work without them, so fail fast with the
// variable names and never the values.
const auth0Domain = env.auth0.domain;
const auth0Audience = env.auth0.audience;
if (!auth0Domain || !auth0Audience) {
	throw new Error(
		"Missing required environment variables: AUTH0_DOMAIN and AUTH0_AUDIENCE",
	);
}

const app = buildApp({
	createCompany: new CreateCompanyUseCase({ companyRepository }),
	listCompanies: new ListCompaniesUseCase({ companyRepository }),
	requireAuth: createRequireAuth({
		issuerBaseURL: `https://${auth0Domain}/`,
		audience: auth0Audience,
	}),
});

app.listen(env.port, () => {
	console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
