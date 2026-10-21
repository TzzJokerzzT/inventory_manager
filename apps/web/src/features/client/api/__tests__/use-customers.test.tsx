import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { customersQueryKey, useCustomers } from "../use-customers";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryProvider>{children}</QueryProvider>;
}

function customer(overrides: Record<string, unknown> = {}) {
	return {
		id: "cu1",
		companyId: "c1",
		name: "Distribuidora Pérez",
		email: "ventas@perez.com",
		phone: "+54 11 4321-9876",
		address: "Av. Siempre Viva 742",
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
		...overrides,
	};
}

function mockGet(data: unknown) {
	const get = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		get,
	} as unknown as ReturnType<typeof getApiClient>);
	return get;
}

describe("customersQueryKey", () => {
	it("scopes every cached search to its company and its term", () => {
		expect(customersQueryKey("c1")).toEqual(["customers", "c1", ""]);
		expect(customersQueryKey("c1", "perez")).toEqual([
			"customers",
			"c1",
			"perez",
		]);
		expect(customersQueryKey("c2", "perez")).toEqual([
			"customers",
			"c2",
			"perez",
		]);
	});
});

describe("useCustomers", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the active company's customers and parses them at the boundary", async () => {
		const list = [customer(), customer({ id: "cu2", name: "Almacén Sur" })];
		const get = mockGet(list);

		const { result } = renderHook(() => useCustomers("c1"), { wrapper });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/customers", undefined);
		expect(result.current.data).toEqual(list);
	});

	it("sends the search term as a query parameter", async () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useCustomers("c1", "perez"), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/customers", {
			params: { search: "perez" },
		});
	});

	it("trims the term and omits it when it is blank", async () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useCustomers("c1", "   "), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/customers", undefined);
	});

	it("does not call the API without an active company", () => {
		const get = mockGet([]);

		const { result } = renderHook(() => useCustomers(undefined), { wrapper });

		expect(get).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("surfaces a data error when the list shape is wrong", async () => {
		mockGet({ customers: [] });

		const { result } = renderHook(() => useCustomers("c1"), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
