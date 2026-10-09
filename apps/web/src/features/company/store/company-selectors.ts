import type { Company } from "@/lib/api/schemas";
import { useCompanies } from "../api/use-companies";
import { useCompanyStore } from "./company-store";

/**
 * Derives the active company from the list and the stored id.
 *
 * The rules are a pure read, never an effect:
 * - zero companies → no active company;
 * - a stored id that is still in the list → that company wins;
 * - a stored id that disappeared → fall back to the first company.
 */
export function selectActiveCompany(
	companies: Company[] | undefined,
	activeCompanyId: string | undefined,
): Company | undefined {
	if (!companies || companies.length === 0) {
		return undefined;
	}

	return (
		companies.find((company) => company.id === activeCompanyId) ?? companies[0]
	);
}

/**
 * The switcher only makes sense when there is a real choice: two or more.
 */
export function shouldShowCompanySwitcher(
	companies: Company[] | undefined,
): boolean {
	return (companies?.length ?? 0) >= 2;
}

export function useActiveCompany(): Company | undefined {
	const { data: companies } = useCompanies();
	const activeCompanyId = useCompanyStore((state) => state.activeCompanyId);
	return selectActiveCompany(companies, activeCompanyId);
}

export function useCompanySwitcherVisibility(): boolean {
	const { data: companies } = useCompanies();
	return shouldShowCompanySwitcher(companies);
}
