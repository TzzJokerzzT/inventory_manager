import { Company } from "../../domain/entities/company.js";
import type {
	CompanyOwner,
	CompanyRepository,
} from "../../domain/repositories/company-repository.js";

export interface CreateCompanyInput {
	name: string;
}

export interface CreateCompanyDependencies {
	companyRepository: CompanyRepository;
}

export class CreateCompanyUseCase {
	private readonly companyRepository: CompanyRepository;

	constructor(dependencies: CreateCompanyDependencies) {
		this.companyRepository = dependencies.companyRepository;
	}

	async execute(
		input: CreateCompanyInput,
		owner: CompanyOwner,
	): Promise<Company> {
		const company = Company.create({ name: input.name });
		return this.companyRepository.createOwnedBy(company, owner);
	}
}
