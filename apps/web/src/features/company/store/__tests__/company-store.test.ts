import { useCompanyStore } from "../company-store";

describe("company store", () => {
	beforeEach(() => {
		useCompanyStore.setState({ activeCompanyId: undefined });
	});

	it("starts without an active company", () => {
		expect(useCompanyStore.getState().activeCompanyId).toBeUndefined();
	});

	it("stores the user's explicit choice", () => {
		useCompanyStore.getState().setActiveCompanyId("company-1");

		expect(useCompanyStore.getState().activeCompanyId).toBe("company-1");
	});

	it("replaces the previous choice instead of appending", () => {
		useCompanyStore.getState().setActiveCompanyId("company-1");
		useCompanyStore.getState().setActiveCompanyId("company-2");

		expect(useCompanyStore.getState().activeCompanyId).toBe("company-2");
	});
});
