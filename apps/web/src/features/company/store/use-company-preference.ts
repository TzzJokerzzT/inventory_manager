"use client";

import { useEffect } from "react";
import { useMe } from "../../user/api/use-me";
import { useCompanies } from "../api/use-companies";
import {
	clearCompanyPreference,
	readCompanyPreference,
	writeCompanyPreference,
} from "./company-preference";
import { useCompanyStore } from "./company-store";

/**
 * Keeps the active company in sync with `localStorage`, scoped to the user.
 *
 * Two effects, each with one job:
 *
 * 1. **Restore.** Once the user (`GET /me`) and their companies are known, and
 *    only while there is no explicit selection in this session, the last stored
 *    selection is restored **if it is a company of this user**. A stored id
 *    that is no longer in the list (the user left the company, or it was
 *    deleted) is dropped and the fallback company is stored instead. A value
 *    stored by another account is never even considered: the storage layer
 *    cross-checks the user id.
 * 2. **Persist.** Every explicit selection (the switcher, or creating a
 *    company) is written immediately with the user it belongs to.
 *
 * The restore runs before the persist effect in the same commit, so the value
 * the user sees after a reload is the one that stays stored; the persist effect
 * only writes an id that was already selected, never a guess.
 */
export function useCompanyPreference(): void {
	const { data: me } = useMe();
	const { data: companies } = useCompanies();
	const activeCompanyId = useCompanyStore((state) => state.activeCompanyId);
	const setActiveCompanyId = useCompanyStore(
		(state) => state.setActiveCompanyId,
	);
	const userId = me?.id;

	useEffect(() => {
		if (!userId || !companies || companies.length === 0) {
			return;
		}
		if (activeCompanyId !== undefined) {
			// This session already has an explicit selection; it wins over
			// whatever was stored before.
			return;
		}

		const storedCompanyId = readCompanyPreference(userId);
		if (storedCompanyId !== undefined) {
			if (companies.some((company) => company.id === storedCompanyId)) {
				setActiveCompanyId(storedCompanyId);
				return;
			}
			// Stale selection: the company is not in this user's list any more.
			clearCompanyPreference();
		}

		// No usable preference: store the company the selectors fall back to, so
		// the next load lands on the same one.
		writeCompanyPreference(userId, companies[0].id);
	}, [userId, companies, activeCompanyId, setActiveCompanyId]);

	useEffect(() => {
		if (!userId || activeCompanyId === undefined) {
			return;
		}

		writeCompanyPreference(userId, activeCompanyId);
	}, [userId, activeCompanyId]);
}
