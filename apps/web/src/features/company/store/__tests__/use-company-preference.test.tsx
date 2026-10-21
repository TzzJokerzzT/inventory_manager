import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import {
	readCompanyPreference,
	writeCompanyPreference,
} from "../company-preference";
import { useCompanyStore } from "../company-store";
import { useCompanyPreference } from "../use-company-preference";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

function company(id: string, name: string) {
	return { id, name, createdAt: "2026-10-06T00:00:00.000Z" };
}

function mockApi(companies: ReturnType<typeof company>[], userId = USER_ID) {
	getApiClientMock.mockReturnValue({
		get: jest.fn(async (url: string) => {
			if (url === "/me") {
				return {
					data: {
						id: userId,
						email: "user@example.com",
						fullName: "User",
						createdAt: "2026-10-06T00:00:00.000Z",
						memberships: companies.map((item) => ({
							companyId: item.id,
							role: "OWNER",
							company: item,
						})),
					},
				};
			}
			if (url === "/companies") {
				return { data: companies };
			}
			throw new Error(`Unexpected request: ${url}`);
		}),
	} as unknown as ReturnType<typeof getApiClient>);
}

function Probe() {
	useCompanyPreference();
	const activeCompanyId = useCompanyStore((state) => state.activeCompanyId);
	return <span data-testid="active">{activeCompanyId ?? "none"}</span>;
}

function renderProbe() {
	return render(<Probe />, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryProvider>{children}</QueryProvider>
		),
	});
}

/** Waits until both queries resolved and the hook ran its effects. */
async function waitForResolution() {
	await waitFor(() => {
		expect(getApiClientMock).toHaveBeenCalled();
	});
	await waitFor(() => {
		expect(screen.getByTestId("active")).toBeTruthy();
	});
}

describe("useCompanyPreference", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		window.localStorage.clear();
		useCompanyStore.setState({ activeCompanyId: undefined });
	});

	it("restores the last company the same user selected", async () => {
		writeCompanyPreference(USER_ID, "c2");
		mockApi([company("c1", "Uno"), company("c2", "Dos")]);

		renderProbe();
		await waitForResolution();

		await waitFor(() => {
			expect(screen.getByTestId("active").textContent).toBe("c2");
		});
	});

	it("never restores a company stored by another user", async () => {
		writeCompanyPreference(OTHER_USER_ID, "c2");
		mockApi([company("c1", "Uno"), company("c2", "Dos")]);

		renderProbe();
		await waitForResolution();

		// The foreign selection is discarded, never restored: the hook falls back
		// to the first company of the *current* user and stores that instead.
		expect(screen.getByTestId("active").textContent).toBe("none");
		await waitFor(() => {
			expect(readCompanyPreference(USER_ID)).toBe("c1");
		});
	});

	it("persists an explicit selection as soon as it happens", async () => {
		mockApi([company("c1", "Uno"), company("c2", "Dos")]);

		renderProbe();
		await waitForResolution();

		act(() => {
			useCompanyStore.getState().setActiveCompanyId("c2");
		});

		await waitFor(() => {
			expect(readCompanyPreference(USER_ID)).toBe("c2");
		});
	});

	it("drops a stored company that is no longer in the list and stores the fallback", async () => {
		writeCompanyPreference(USER_ID, "gone");
		mockApi([company("c1", "Uno")]);

		renderProbe();
		await waitForResolution();

		expect(screen.getByTestId("active").textContent).toBe("none");
		await waitFor(() => {
			expect(readCompanyPreference(USER_ID)).toBe("c1");
		});
	});
});
