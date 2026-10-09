import { create } from "zustand";

/**
 * The user's explicit choice of active company.
 *
 * Only the selected id lives here. Which company that id resolves to — including
 * the fallback to the first company when the stored id disappears from the list
 * — is a *derived read* computed by the selectors, never stored here and never
 * synchronized with effects.
 */
export interface CompanyStoreState {
	activeCompanyId?: string;
	setActiveCompanyId: (id: string) => void;
}

export const useCompanyStore = create<CompanyStoreState>((set) => ({
	activeCompanyId: undefined,
	setActiveCompanyId: (activeCompanyId) => set({ activeCompanyId }),
}));
