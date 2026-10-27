import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/schemas";
import { useCreateCategory } from "../api/use-create-category";
import { useUpdateCategory } from "../api/use-update-category";
import { CategoryForm } from "../components/category-form";

jest.mock("../api/use-create-category", () => ({
	useCreateCategory: jest.fn(),
}));

jest.mock("../api/use-update-category", () => ({
	useUpdateCategory: jest.fn(),
}));

const useCreateCategoryMock = useCreateCategory as jest.MockedFunction<
	typeof useCreateCategory
>;
const useUpdateCategoryMock = useUpdateCategory as jest.MockedFunction<
	typeof useUpdateCategory
>;

const createMutate = jest.fn();
const updateMutate = jest.fn();
const onSaved = jest.fn();
const onCancel = jest.fn();

/**
 * The real mutation calls `onSuccess` on success; the stub resumes that contract
 * so the form's "go back to the list after saving" path is exercised too.
 */
function stubMutation(mutate: jest.Mock, state: Record<string, unknown> = {}) {
	return {
		mutate: jest.fn((body, options?: { onSuccess?: () => void }) => {
			mutate(body, options);
			options?.onSuccess?.();
		}),
		mutateAsync: mutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	};
}

function mockHooks(
	state: {
		create?: Record<string, unknown>;
		update?: Record<string, unknown>;
	} = {},
) {
	useCreateCategoryMock.mockReturnValue(
		stubMutation(createMutate, state.create) as unknown as ReturnType<
			typeof useCreateCategory
		>,
	);
	useUpdateCategoryMock.mockReturnValue(
		stubMutation(updateMutate, state.update) as unknown as ReturnType<
			typeof useUpdateCategory
		>,
	);
}

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

function fill(value: string) {
	fireEvent.change(screen.getByLabelText("Nombre de la categoría"), {
		target: { value },
	});
}

function renderCreate() {
	return render(
		<CategoryForm companyId="c1" onSaved={onSaved} onCancel={onCancel} />,
	);
}

function renderEdit(overrides: Partial<Category> = {}) {
	return render(
		<CategoryForm
			companyId="c1"
			category={category(overrides)}
			onSaved={onSaved}
			onCancel={onCancel}
		/>,
	);
}

describe("CategoryForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockHooks();
	});

	it("creates a category with the trimmed name", () => {
		renderCreate();

		fill("  Bebidas  ");
		fireEvent.click(screen.getByRole("button", { name: "Crear categoría" }));

		expect(createMutate).toHaveBeenCalledWith(
			{ name: "Bebidas" },
			expect.anything(),
		);
		expect(onSaved).toHaveBeenCalled();
	});

	it("blocks the submit when the name is blank", () => {
		renderCreate();

		fill("   ");
		fireEvent.click(screen.getByRole("button", { name: "Crear categoría" }));

		expect(createMutate).not.toHaveBeenCalled();
		expect(screen.getByText("Ingresá el nombre de la categoría.")).toBeTruthy();
	});

	it("shows the API message of the duplicate name instead of failing silently", () => {
		mockHooks({
			create: {
				isError: true,
				error: new ApiError(
					"A category with that name already exists in the company",
					409,
					"category_name_already_exists",
				),
			},
		});
		renderCreate();

		expect(
			screen.getByText(
				"A category with that name already exists in the company",
			),
		).toBeTruthy();
	});

	it("pre-fills the name of the category being edited", () => {
		renderEdit();

		expect(
			(screen.getByLabelText("Nombre de la categoría") as HTMLInputElement)
				.value,
		).toBe("Bebidas");
	});

	it("patches the category that is being edited", () => {
		renderEdit();

		fill("  Bebidas sin alcohol  ");
		fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

		expect(updateMutate).toHaveBeenCalledWith(
			{ categoryId: "ca1", name: "Bebidas sin alcohol" },
			expect.anything(),
		);
		expect(onSaved).toHaveBeenCalled();
	});

	it("explains a category deleted from another tab", () => {
		mockHooks({
			update: {
				isError: true,
				error: new ApiError("Category not found", 404, "category_not_found"),
			},
		});
		renderEdit();

		expect(
			screen.getByText("Esa categoría ya no existe en esta empresa."),
		).toBeTruthy();
	});

	it("disables the form while the save is in flight", () => {
		mockHooks({ create: { isPending: true } });
		renderCreate();

		const submit = screen.getByRole("button", { name: /Creando/ });
		expect((submit as HTMLButtonElement).disabled).toBe(true);
		expect(
			(screen.getByLabelText("Nombre de la categoría") as HTMLInputElement)
				.disabled,
		).toBe(true);
	});

	it("reports the cancel to the parent", () => {
		renderCreate();

		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(onCancel).toHaveBeenCalled();
		expect(createMutate).not.toHaveBeenCalled();
	});
});
