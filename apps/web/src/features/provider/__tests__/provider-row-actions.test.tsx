import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { SupplierListItem } from "@/lib/api/schemas";
import { useDeleteProvider } from "../api/use-delete-provider";
import { ProviderRowActions } from "../components/provider-row-actions";

jest.mock("../api/use-delete-provider", () => ({
	useDeleteProvider: jest.fn(),
}));

const useDeleteProviderMock = useDeleteProvider as jest.MockedFunction<
	typeof useDeleteProvider
>;

const removeMutate = jest.fn();
const onEdit = jest.fn();

function provider(overrides: Partial<SupplierListItem> = {}): SupplierListItem {
	return {
		id: "su1",
		companyId: "c1",
		name: "Plásticos del Sur",
		contact: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		lastLot: null,
		...overrides,
	};
}

function mockDelete(state: Record<string, unknown> = {}) {
	useDeleteProviderMock.mockReturnValue({
		mutate: removeMutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useDeleteProvider>);
}

function renderActions() {
	return render(
		<ProviderRowActions companyId="c1" provider={provider()} onEdit={onEdit} />,
	);
}

/** Opens the confirmation dialog from the row's delete button. */
function openDialog() {
	fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
	return screen.getByRole("dialog", { name: "Eliminar proveedor" });
}

describe("ProviderRowActions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockDelete();
	});

	it("opens the edit form for that supplier", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Editar" }));

		expect(onEdit).toHaveBeenCalledWith(provider());
	});

	it("opens the confirmation dialog naming the supplier", () => {
		renderActions();

		const dialog = openDialog();

		expect(within(dialog).getByText(/Plásticos del Sur/)).toBeTruthy();
		expect(removeMutate).not.toHaveBeenCalled();
	});

	it("deletes only after confirming in the dialog", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		expect(removeMutate).toHaveBeenCalledTimes(1);
		const [variables, options] = removeMutate.mock.calls[0];
		expect(variables).toEqual({ supplierId: "su1" });
		expect(typeof options?.onSuccess).toBe("function");
	});

	it("closes the dialog once the deletion succeeds", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		act(() => {
			removeMutate.mock.calls[0][1].onSuccess();
		});

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("keeps the supplier when the dialog is cancelled", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

		expect(removeMutate).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("surfaces the API message inside the dialog when the deletion fails", () => {
		mockDelete({
			isError: true,
			error: new ApiError(
				"No tenés permiso para esta acción.",
				403,
				"insufficient_role",
			),
		});
		renderActions();

		const dialog = openDialog();

		expect(
			within(dialog).getByText("No tenés permiso para esta acción."),
		).toBeTruthy();
	});
});
