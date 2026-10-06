import type { Company } from "../../domain/entities/company.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";

export interface ListCompaniesDependencies {
	companyRepository: CompanyRepository;
}

export class ListCompaniesUseCase {
	private readonly companyRepository: CompanyRepository;

	constructor(dependencies: ListCompaniesDependencies) {
		this.companyRepository = dependencies.companyRepository;
	}

	async execute(): Promise<Company[]> {
		return this.companyRepository.findAll();
	}
}
