import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/schemas";
import { useDeleteCategory } from "../api/use-delete-category";
import { CategoryRowActions } from "../components/category-row-actions";

jest.mock("../api/use-delete-category", () => ({
	useDeleteCategory: jest.fn(),
}));

const useDeleteCategoryMock = useDeleteCategory as jest.MockedFunction<
	typeof useDeleteCategory
>;

const removeMutate = jest.fn();
const onEdit = jest.fn();

function category(overrides: Partial<Category> = {}): Category {
	return {
		id: "ca1",
		companyId: "c1",
		name: "Bebidas",
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
		...overrides,
	};
}

function mockDelete(state: Record<string, unknown> = {}) {
	useDeleteCategoryMock.mockReturnValue({
		mutate: removeMutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useDeleteCategory>);
}

function renderActions() {
	return render(
		<CategoryRowActions companyId="c1" category={category()} onEdit={onEdit} />,
	);
}

/** Opens the confirmation dialog from the row's delete button. */
function openDialog() {
	fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
	return screen.getByRole("dialog", { name: "Eliminar categoría" });
}

describe("CategoryRowActions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockDelete();
	});

	it("opens the edit form for that category", () => {
		renderActions();

		fireEvent.click(screen.getByRole("button", { name: "Editar" }));

		expect(onEdit).toHaveBeenCalledWith(category());
	});

	it("opens the confirmation dialog naming the category", () => {
		renderActions();

		const dialog = openDialog();

		expect(within(dialog).getByText(/Bebidas/)).toBeTruthy();
		expect(removeMutate).not.toHaveBeenCalled();
	});

	it("deletes only after confirming in the dialog", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		expect(removeMutate).toHaveBeenCalledTimes(1);
		const [variables, options] = removeMutate.mock.calls[0];
		expect(variables).toEqual({ categoryId: "ca1" });
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

	it("keeps the category when the dialog is cancelled", () => {
		renderActions();

		const dialog = openDialog();
		fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

		expect(removeMutate).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("shows the API message of the products that still use the category", () => {
		// `category_in_use` carries the product count, so the message the API
		// sent is the one worth showing: it says why the row could not go.
		mockDelete({
			isError: true,
			error: new ApiError(
				"Category is in use by 2 products and cannot be deleted",
				409,
				"category_in_use",
			),
		});
		renderActions();

		const dialog = openDialog();

		expect(
			within(dialog).getByText(
				"Category is in use by 2 products and cannot be deleted",
			),
		).toBeTruthy();
		// Nothing was deleted: the row is still there, and the dialog stays open
		// so the message is not lost by a close on failure.
		expect(removeMutate).not.toHaveBeenCalled();
		expect(
			screen.getByRole("dialog", { name: "Eliminar categoría" }),
		).toBeTruthy();
	});

	it("surfaces a role failure inside the dialog", () => {
		mockDelete({
			isError: true,
			error: new ApiError("No tenés permiso para esta acción.", 403),
		});
		renderActions();

		const dialog = openDialog();

		expect(
			within(dialog).getByText("No tenés permiso para esta acción."),
		).toBeTruthy();
	});
});
