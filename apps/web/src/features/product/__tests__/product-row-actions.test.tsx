import { fireEvent, render, screen } from "@testing-library/react";
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

	it("asks for confirmation before deleting", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

		expect(mutate).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
	});

	it("deletes only after the confirmation", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

		expect(mutate).toHaveBeenCalledWith({ productId: "p1" });
	});

	it("keeps the product when the confirmation is cancelled", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(mutate).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
	});

	it("shows the API message when the role cannot delete", () => {
		mockDelete({
			isError: true,
			error: new ApiError(
				"Tu rol no permite esta acción.",
				403,
				"insufficient_role",
			),
		});
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

		expect(screen.getByRole("alert").textContent).toContain(
			"Tu rol no permite esta acción.",
		);
	});

	it("blocks the confirmation while the deletion is in flight", () => {
		mockDelete({ isPending: true });
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

		expect(
			screen
				.getByRole("button", { name: "Confirmar" })
				.hasAttribute("disabled"),
		).toBe(true);
	});
});
