import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { useCompanies } from "../api/use-companies";
import { useCreateCompany } from "../api/use-create-company";
import { useCompanyStore } from "../store/company-store";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function company(id: string, name: string) {
	return { id, name, createdAt: "2026-10-06T00:00:00.000Z" };
}

function makeWrapper(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("useCreateCompany", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useCompanyStore.setState({ activeCompanyId: undefined });
	});

	it("posts the name and leaves the created company active", async () => {
		const created = company("c-new", "Nueva");
		const post = jest.fn(async () => ({ data: created }));
		getApiClientMock.mockReturnValue({
			post,
		} as unknown as ReturnType<typeof getApiClient>);

		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const { result } = renderHook(() => useCreateCompany(), {
			wrapper: makeWrapper(queryClient),
		});

		await result.current.mutateAsync({ name: "Nueva" });

		expect(post).toHaveBeenCalledWith("/companies", { name: "Nueva" });
		expect(useCompanyStore.getState().activeCompanyId).toBe("c-new");
	});

	it("invalidates the companies list on success so it refetches", async () => {
		const created = company("c-new", "Nueva");
		const get = jest.fn(async () => ({ data: [] }));
		const post = jest.fn(async () => ({ data: created }));
		getApiClientMock.mockReturnValue({
			get,
			post,
		} as unknown as ReturnType<typeof getApiClient>);

		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = makeWrapper(queryClient);

		const companiesHook = renderHook(() => useCompanies(), { wrapper });
		await waitFor(() => {
			expect(companiesHook.result.current.data).toEqual([]);
		});

		const createHook = renderHook(() => useCreateCompany(), { wrapper });
		await createHook.result.current.mutateAsync({ name: "Nueva" });

		await waitFor(() => {
			expect(get).toHaveBeenCalledTimes(2);
		});
	});
});
