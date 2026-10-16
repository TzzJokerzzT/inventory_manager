import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { useMe } from "../use-me";
import { useUpdateFullName } from "../use-update-full-name";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

function meResponse(fullName: string | null) {
	return {
		id: "user-1",
		email: "ana@empresa.com",
		fullName,
		createdAt: "2026-10-06T00:00:00.000Z",
		memberships: [
			{
				companyId: "c1",
				role: "OWNER",
				company: {
					id: "c1",
					name: "Primera",
					createdAt: "2026-10-06T00:00:00.000Z",
				},
			},
		],
	};
}

function makeWrapper(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function makeClient() {
	return new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
}

describe("useUpdateFullName", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("patches /me with the new full name and returns the parsed identity", async () => {
		const updated = meResponse("Ana Pérez");
		const patch = jest.fn(async () => ({ data: updated }));
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useUpdateFullName(), {
			wrapper: makeWrapper(makeClient()),
		});

		await expect(
			result.current.mutateAsync({ fullName: "Ana Pérez" }),
		).resolves.toEqual(updated);
		expect(patch).toHaveBeenCalledWith("/me", { fullName: "Ana Pérez" });
	});

	it("invalidates /me on success so the gate sees the new name", async () => {
		let current = meResponse(null);
		const get = jest.fn(async () => ({ data: current }));
		const patch = jest.fn(async () => {
			current = meResponse("Ana Pérez");
			return { data: current };
		});
		getApiClientMock.mockReturnValue({
			get,
			patch,
		} as unknown as ReturnType<typeof getApiClient>);

		const queryClient = makeClient();
		const wrapper = makeWrapper(queryClient);

		const meHook = renderHook(() => useMe(), { wrapper });
		await waitFor(() => {
			expect(meHook.result.current.data?.fullName).toBeNull();
		});

		const updateHook = renderHook(() => useUpdateFullName(), { wrapper });
		await updateHook.result.current.mutateAsync({ fullName: "Ana Pérez" });

		await waitFor(() => {
			expect(get).toHaveBeenCalledTimes(2);
		});
		await waitFor(() => {
			expect(meHook.result.current.data?.fullName).toBe("Ana Pérez");
		});
	});

	it("surfaces a data error when the response has the wrong shape", async () => {
		const patch = jest.fn(async () => ({ data: { unexpected: true } }));
		getApiClientMock.mockReturnValue({
			patch,
		} as unknown as ReturnType<typeof getApiClient>);

		const { result } = renderHook(() => useUpdateFullName(), {
			wrapper: makeWrapper(makeClient()),
		});

		await expect(
			result.current.mutateAsync({ fullName: "Ana Pérez" }),
		).rejects.toThrow(/respuesta inesperada/);
	});
});
