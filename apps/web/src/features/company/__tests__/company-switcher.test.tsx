import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getApiClient } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { CompanySwitcher } from "../components/company-switcher";
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

function mockGet(data: unknown) {
	getApiClientMock.mockReturnValue({
		get: jest.fn(async () => ({ data })),
	} as unknown as ReturnType<typeof getApiClient>);
}

function renderSwitcher() {
	return render(<CompanySwitcher />, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryProvider>{children}</QueryProvider>
		),
	});
}

describe("CompanySwitcher", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useCompanyStore.setState({ activeCompanyId: undefined });
	});

	it("renders nothing with zero companies", async () => {
		mockGet([]);

		const { container } = renderSwitcher();

		await waitFor(() => {
			expect(getApiClientMock).toHaveBeenCalled();
		});

		expect(container.firstChild).toBeNull();
	});

	it("renders nothing with exactly one company", async () => {
		mockGet([company("c1", "Única")]);

		const { container } = renderSwitcher();

		await waitFor(() => {
			expect(getApiClientMock).toHaveBeenCalled();
		});

		expect(container.firstChild).toBeNull();
	});

	it("shows the active company's name in the trigger with two or more", async () => {
		mockGet([company("c1", "Primera"), company("c2", "Segunda")]);

		renderSwitcher();

		const trigger = await screen.findByRole("button", { name: "Primera" });

		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("marks the active company in the menu", async () => {
		mockGet([company("c1", "Primera"), company("c2", "Segunda")]);

		renderSwitcher();

		fireEvent.click(await screen.findByRole("button", { name: "Primera" }));

		const activeItem = screen.getByRole("menuitem", { name: "Primera" });
		const inactiveItem = screen.getByRole("menuitem", { name: "Segunda" });

		expect(activeItem.getAttribute("aria-current")).toBe("true");
		expect(inactiveItem.getAttribute("aria-current")).toBeNull();
	});

	it("makes the chosen company active and closes the menu", async () => {
		mockGet([company("c1", "Primera"), company("c2", "Segunda")]);

		renderSwitcher();

		fireEvent.click(await screen.findByRole("button", { name: "Primera" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Segunda" }));

		expect(useCompanyStore.getState().activeCompanyId).toBe("c2");

		await waitFor(() => {
			expect(screen.queryByRole("menuitem")).toBeNull();
		});

		const trigger = screen.getByRole("button", { name: "Segunda" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("closes the menu on Escape", async () => {
		mockGet([company("c1", "Primera"), company("c2", "Segunda")]);

		renderSwitcher();

		fireEvent.click(await screen.findByRole("button", { name: "Primera" }));
		expect(screen.getByRole("menuitem", { name: "Segunda" })).toBeTruthy();

		fireEvent.keyDown(window, { key: "Escape" });

		await waitFor(() => {
			expect(screen.queryByRole("menuitem")).toBeNull();
		});
		expect(
			screen
				.getByRole("button", { name: "Primera" })
				.getAttribute("aria-expanded"),
		).toBe("false");
	});
});
