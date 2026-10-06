import { CreateCompanyUseCase } from "./application/use-cases/create-company.js";
import { ListCompaniesUseCase } from "./application/use-cases/list-companies.js";
import { env } from "./config/env.js";
import { InMemoryCompanyRepository } from "./infrastructure/database/in-memory-company-repository.js";
import { buildApp } from "./interfaces/http/app.js";

// Composition root: the only place where concrete implementations are chosen.
// Swapping the in-memory adapter for the Prisma one happens here and nowhere else.
const companyRepository = new InMemoryCompanyRepository();

const app = buildApp({
	createCompany: new CreateCompanyUseCase({ companyRepository }),
	listCompanies: new ListCompaniesUseCase({ companyRepository }),
});

app.listen(env.port, () => {
	console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
