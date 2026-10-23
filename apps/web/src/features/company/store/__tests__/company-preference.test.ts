import {
	COMPANY_PREFERENCE_STORAGE_KEY,
	clearCompanyPreference,
	readCompanyPreference,
	writeCompanyPreference,
} from "../company-preference";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const COMPANY_ID = "company-1";

function storedValue(): unknown {
	const raw = window.localStorage.getItem(COMPANY_PREFERENCE_STORAGE_KEY);
	return raw === null ? null : JSON.parse(raw);
}

describe("company preference storage", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("round-trips the selected company with the user it belongs to", () => {
		writeCompanyPreference(USER_ID, COMPANY_ID);

		expect(storedValue()).toEqual({
			userId: USER_ID,
			companyId: COMPANY_ID,
		});
		expect(readCompanyPreference(USER_ID)).toBe(COMPANY_ID);
	});

	it("answers undefined and drops the entry when it belongs to another user", () => {
		writeCompanyPreference(OTHER_USER_ID, COMPANY_ID);

		expect(readCompanyPreference(USER_ID)).toBeUndefined();
		expect(
			window.localStorage.getItem(COMPANY_PREFERENCE_STORAGE_KEY),
		).toBeNull();
	});

	it("answers undefined for malformed JSON and removes it", () => {
		window.localStorage.setItem(COMPANY_PREFERENCE_STORAGE_KEY, "{not json");

		expect(readCompanyPreference(USER_ID)).toBeUndefined();
		expect(
			window.localStorage.getItem(COMPANY_PREFERENCE_STORAGE_KEY),
		).toBeNull();
	});

	it("answers undefined for a payload without both ids", () => {
		window.localStorage.setItem(
			COMPANY_PREFERENCE_STORAGE_KEY,
			JSON.stringify({ userId: USER_ID }),
		);

		expect(readCompanyPreference(USER_ID)).toBeUndefined();
	});

	it("overwrites the previous company for the same user", () => {
		writeCompanyPreference(USER_ID, COMPANY_ID);
		writeCompanyPreference(USER_ID, "company-2");

		expect(readCompanyPreference(USER_ID)).toBe("company-2");
	});

	it("clears the stored preference", () => {
		writeCompanyPreference(USER_ID, COMPANY_ID);

		clearCompanyPreference();

		expect(readCompanyPreference(USER_ID)).toBeUndefined();
	});

	it("survives a storage that refuses writes", () => {
		const setItem = jest
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(() => {
				throw new Error("QuotaExceededError");
			});

		expect(() => writeCompanyPreference(USER_ID, COMPANY_ID)).not.toThrow();

		setItem.mockRestore();
	});
});
