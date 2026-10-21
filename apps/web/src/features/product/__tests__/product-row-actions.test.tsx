import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { useDeleteProduct } from "../api/use-delete-product";
import { ProductRowActions } from "../components/product-row-actions";

jest.mock("../api/use-delete-product", () => ({
	useDeleteProduct: jest.fn(),
}));

const useDeleteProductMock = useDeleteProduct as jest.MockedFunction<
	typeof useDeleteProduct
>;
const mutate = jest.fn();

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

function renderActions() {
	return render(<ProductRowActions companyId="c1" product={product()} />);
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

		expect(
			within(dialog)
				.getByRole("button", { name: "Eliminar" })
				.hasAttribute("disabled"),
		).toBe(true);
	});
});
