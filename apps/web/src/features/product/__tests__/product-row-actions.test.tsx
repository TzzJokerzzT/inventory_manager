import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { useDeleteProduct } from "../api/use-delete-product";
import { usePurgeProduct } from "../api/use-purge-product";
import { useRestoreProduct } from "../api/use-restore-product";
import { ProductRowActions } from "../components/product-row-actions";

jest.mock("../api/use-delete-product", () => ({
	useDeleteProduct: jest.fn(),
}));

jest.mock("../api/use-purge-product", () => ({
	usePurgeProduct: jest.fn(),
}));

jest.mock("../api/use-restore-product", () => ({
	useRestoreProduct: jest.fn(),
}));

const useDeleteProductMock = useDeleteProduct as jest.MockedFunction<
	typeof useDeleteProduct
>;
const usePurgeProductMock = usePurgeProduct as jest.MockedFunction<
	typeof usePurgeProduct
>;
const useRestoreProductMock = useRestoreProduct as jest.MockedFunction<
	typeof useRestoreProduct
>;
const mutate = jest.fn();
const restoreMutate = jest.fn();
const purgeMutate = jest.fn();

function product(): ProductModel {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 0,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
	};
}

function mockDelete(state: Record<string, unknown> = {}) {
	useDeleteProductMock.mockReturnValue({
		mutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useDeleteProduct>);
}

function mockRestore(state: Record<string, unknown> = {}) {
	useRestoreProductMock.mockReturnValue({
		mutate: restoreMutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useRestoreProduct>);
}

function mockPurge(state: Record<string, unknown> = {}) {
	usePurgeProductMock.mockReturnValue({
		mutate: purgeMutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof usePurgeProduct>);
}

function renderActions() {
	return render(<ProductRowActions companyId="c1" product={product()} />);
}

function renderTrashActions({ canPurge = false } = {}) {
	return render(
		<ProductRowActions
			companyId="c1"
			product={product()}
			mode="trash"
			canPurge={canPurge}
		/>,
	);
}

/** Opens the permanent-delete dialog from the trash row. */
function openPurgeDialog() {
	fireEvent.click(
		screen.getByRole("button", { name: "Eliminar definitivamente" }),
	);
	return screen.getByRole("dialog", { name: "Eliminar definitivamente" });
}

/** Opens the confirmation dialog from the trash button in the row. */
function openDialog() {
	fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
	return screen.getByRole("dialog", { name: "Eliminar producto" });
}

describe("ProductRowActions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockDelete();
		mockRestore();
		mockPurge();
	});

	it("links to the edit view of the product", () => {
		renderActions();

		expect(
			screen.getByRole("link", { name: "Editar" }).getAttribute("href"),
		).toBe("/dashboard/products/p1/edit");
	});

	it("opens the confirmation dialog naming the product and the soft delete", () => {
		renderActions();

		const dialog = openDialog();

		expect(within(dialog).getByText(/Café molido 500g/)).toBeTruthy();
		expect(within(dialog).getByText(/catálogo/i)).toBeTruthy();
		expect(
			within(dialog).getByRole("button", { name: "Cancelar" }),
		).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("deletes only after confirming in the dialog", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		expect(mutate).toHaveBeenCalledTimes(1);
		const [variables, options] = mutate.mock.calls[0];
		expect(variables).toEqual({ productId: "p1" });
		expect(typeof options?.onSuccess).toBe("function");
	});

	it("closes the dialog once the deletion succeeds", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		act(() => {
			mutate.mock.calls[0][1].onSuccess();
		});

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("keeps the product when the dialog is cancelled", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

		expect(mutate).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
	});

	it("keeps the product when the dialog is dismissed with Escape", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.keyDown(dialog, { key: "Escape" });

		expect(mutate).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("shows the API message inside the dialog when the role cannot delete", () => {
		mockDelete({
			isError: true,
			error: new ApiError(
				"Tu rol no permite esta acción.",
				403,
				"insufficient_role",
			),
		});
		renderActions();

		const dialog = openDialog();

		expect(within(dialog).getByRole("alert").textContent).toContain(
			"Tu rol no permite esta acción.",
		);
	});

	it("blocks the confirmation while the deletion is in flight", () => {
		mockDelete({ isPending: true });
		renderActions();

		const dialog = openDialog();

		// The pending label of the confirm button is the WIP's "Eliminando...".
		expect(
			within(dialog)
				.getByRole("button", { name: /Eliminando/ })
				.hasAttribute("disabled"),
		).toBe(true);
	});
});

describe("ProductRowActions in the trash", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockDelete();
		mockRestore();
		mockPurge();
	});

	it("offers only Restaurar, with no edit or delete", () => {
		renderTrashActions();

		expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
	});

	it("hides the purge from a caller who may not purge", () => {
		renderTrashActions({ canPurge: false });

		expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Eliminar definitivamente" }),
		).toBeNull();
	});

	it("offers the purge to an OWNER", () => {
		renderTrashActions({ canPurge: true });

		expect(
			screen.getByRole("button", { name: "Eliminar definitivamente" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
	});

	it("restores without asking for confirmation", () => {
		renderTrashActions();

		fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(restoreMutate).toHaveBeenCalledTimes(1);
		expect(restoreMutate.mock.calls[0][0]).toEqual({ productId: "p1" });
		expect(mutate).not.toHaveBeenCalled();
	});

	it("blocks Restaurar while the restore is in flight", () => {
		mockRestore({ isPending: true });
		renderTrashActions();

		const button = screen.getByRole("button", { name: /Restaurando/ });

		expect(button.hasAttribute("disabled")).toBe(true);
	});

	it("surfaces the API message when the product was already restored", () => {
		mockRestore({
			isError: true,
			error: new ApiError(
				"El producto ya está activo.",
				409,
				"product_not_deleted",
			),
		});
		renderTrashActions();

		expect(screen.getByRole("alert").textContent).toContain(
			"El producto ya está activo.",
		);
	});

	it("opens the purge dialog warning that it is irreversible and needs no movements", () => {
		renderTrashActions({ canPurge: true });

		const dialog = openPurgeDialog();

		expect(within(dialog).getByText(/irreversible/i)).toBeTruthy();
		expect(within(dialog).getByText(/movimientos/i)).toBeTruthy();
		expect(
			within(dialog).getByRole("button", { name: "Cancelar" }),
		).toBeTruthy();
		expect(purgeMutate).not.toHaveBeenCalled();
	});

	it("purges only after confirming in the dialog", () => {
		renderTrashActions({ canPurge: true });

		const dialog = openPurgeDialog();
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Eliminar definitivamente" }),
		);

		expect(purgeMutate).toHaveBeenCalledTimes(1);
		const [variables, options] = purgeMutate.mock.calls[0];
		expect(variables).toEqual({ productId: "p1" });
		expect(typeof options?.onSuccess).toBe("function");
		expect(restoreMutate).not.toHaveBeenCalled();
		// The soft delete belongs to the catalogue, never to the trash.
		expect(mutate).not.toHaveBeenCalled();
	});

	it("closes the purge dialog once the purge succeeds", () => {
		renderTrashActions({ canPurge: true });

		const dialog = openPurgeDialog();
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Eliminar definitivamente" }),
		);

		act(() => {
			purgeMutate.mock.calls[0][1].onSuccess();
		});

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("keeps the product when the purge dialog is cancelled", () => {
		renderTrashActions({ canPurge: true });

		const dialog = openPurgeDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

		expect(purgeMutate).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Eliminar definitivamente" }),
		).toBeTruthy();
	});

	it("keeps the product when the purge dialog is dismissed with Escape", () => {
		renderTrashActions({ canPurge: true });

		const dialog = openPurgeDialog();
		fireEvent.keyDown(dialog, { key: "Escape" });

		expect(purgeMutate).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("blocks the confirmation while the purge is in flight", () => {
		mockPurge({ isPending: true });
		renderTrashActions({ canPurge: true });

		const dialog = openPurgeDialog();

		// The pending label keeps "Eliminar definitivamente" and adds the spinner.
		expect(
			within(dialog)
				.getByRole("button", { name: /Eliminar definitivamente/ })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("shows the 409 message inside the purge dialog", () => {
		mockPurge({
			isError: true,
			error: new ApiError(
				"El producto tiene 3 movimientos y no se puede eliminar definitivamente.",
				409,
				"product_has_movements",
			),
		});
		renderTrashActions({ canPurge: true });

		const dialog = openPurgeDialog();

		expect(within(dialog).getByRole("alert").textContent).toContain(
			"El producto tiene 3 movimientos y no se puede eliminar definitivamente.",
		);
	});
});
