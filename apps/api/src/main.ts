import { CreateCompanyUseCase } from "./application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "./application/use-cases/list-companies.js";
import { env } from "./config/env.js";
import { createPrismaClient } from "./infrastructure/database/prisma-client.js";
import { PrismaCompanyRepository } from "./infrastructure/database/prisma-company-repository.js";
import { buildApp } from "./interfaces/http/app.js";

// Composition root: the only place where concrete implementations are chosen.
// Production wires the Prisma adapter over the Supabase pooler; the in-memory
// adapter stays available for the test suite, which injects it directly.
const prisma = createPrismaClient();
const companyRepository = new PrismaCompanyRepository({ prisma });

const app = buildApp({
	createCompany: new CreateCompanyUseCase({ companyRepository }),
	listCompanies: new ListCompaniesUseCase({ companyRepository }),
});

app.listen(env.port, () => {
	console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
