import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { customerQueryKey, useCustomer } from "../use-customer";

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

function customer() {
	return {
		id: "cu1",
		companyId: "c1",
		name: "Distribuidora Pérez",
		email: null,
		phone: null,
		address: null,
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
	};
}

function mockGet(data: unknown) {
	const get = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		get,
	} as unknown as ReturnType<typeof getApiClient>);
	return get;
}

describe("customerQueryKey", () => {
	it("scopes the detail to its company and its customer", () => {
		expect(customerQueryKey("c1", "cu1")).toEqual(["customer", "c1", "cu1"]);
	});
});

describe("useCustomer", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads one customer so the edit form works with a cold cache", async () => {
		const stored = customer();
		const get = mockGet(stored);

		const { result } = renderHook(() => useCustomer("c1", "cu1"), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(get).toHaveBeenCalledWith("/companies/c1/customers/cu1");
		expect(result.current.data).toEqual(stored);
	});

	it("does not call the API without a company or a customer", () => {
		const get = mockGet(customer());

		const withoutCompany = renderHook(() => useCustomer(undefined, "cu1"), {
			wrapper,
		});
		const withoutCustomer = renderHook(() => useCustomer("c1", undefined), {
			wrapper,
		});

		expect(get).not.toHaveBeenCalled();
		expect(withoutCompany.result.current.fetchStatus).toBe("idle");
		expect(withoutCustomer.result.current.fetchStatus).toBe("idle");
	});

	it("surfaces the customer_not_found rejection as the ApiError the API sent", async () => {
		getApiClientMock.mockReturnValue({
			get: jest.fn(async () => {
				throw new ApiError(
					"Ese cliente ya no existe en esta empresa.",
					404,
					"customer_not_found",
				);
			}),
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useCustomer("c1", "cu1"), {
			wrapper,
		});

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toMatchObject({
			status: 404,
			code: "customer_not_found",
		});
	});

	it("surfaces a data error when the customer shape is wrong", async () => {
		mockGet({ id: "cu1" });

		const { result } = renderHook(() => useCustomer("c1", "cu1"), {
			wrapper,
		});

		await waitFor(
			() => {
				expect(result.current.isError).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(result.current.error).toBeInstanceOf(ApiError);
	});
});
