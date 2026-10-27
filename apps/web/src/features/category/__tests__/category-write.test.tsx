import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useCategories } from "../api/use-categories";
import { useCreateCategory } from "../api/use-create-category";
import { useUpdateCategory } from "../api/use-update-category";
import { CategoryWrite } from "../category-write";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("../api/use-categories", () => ({ useCategories: jest.fn() }));
jest.mock("../api/use-create-category", () => ({
	useCreateCategory: jest.fn(),
}));
jest.mock("../api/use-update-category", () => ({
	useUpdateCategory: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useCategoriesMock = useCategories as jest.MockedFunction<
	typeof useCategories
>;

const push = jest.fn();

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

function setup({
	rows = [category()],
	categoriesState = {},
	company = { id: "c1", name: "Empresa Uno" },
}: {
	rows?: Category[];
	categoriesState?: Record<string, unknown>;
	company?: { id: string; name: string } | null;
} = {}) {
	useRouterMock.mockReturnValue({
		push,
		replace: jest.fn(),
		refresh: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		prefetch: jest.fn(),
	} as unknown as ReturnType<typeof useRouter>);
	useActiveCompanyMock.mockReturnValue(
		company === null
			? undefined
			: { ...company, createdAt: "2026-10-06T00:00:00.000Z" },
	);
	useCategoriesMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		...categoriesState,
	} as unknown as ReturnType<typeof useCategories>);
	(useCreateCategory as jest.Mock).mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	});
	(useUpdateCategory as jest.Mock).mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	});
}

/**
 * The write page: the category is resolved from the catalogue by id, because
 * the contract has no per-category read, and an id that is not there has to say
 * so instead of offering an empty form that would create a duplicate.
 */
describe("CategoryWrite", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("offers the way back to the catalogue", () => {
		setup();

		render(<CategoryWrite />);

		expect(
			screen
				.getByRole("link", { name: /Volver a categorías/ })
				.getAttribute("href"),
		).toBe("/dashboard/categories");
	});

	it("renders the empty form on the creation route", () => {
		setup();

		render(<CategoryWrite />);

		expect(
			screen.getByRole("heading", { level: 1, name: "Nueva categoría" }),
		).toBeTruthy();
		expect(screen.getByRole("form", { name: "Crear categoría" })).toBeTruthy();
		expect(
			(screen.getByLabelText("Nombre de la categoría") as HTMLInputElement)
				.value,
		).toBe("");
	});

	it("resolves the category from the catalogue on the edit route", () => {
		setup();

		render(<CategoryWrite categoryId="ca1" />);

		expect(useCategoriesMock).toHaveBeenCalledWith("c1");
		expect(screen.getByRole("form", { name: "Editar categoría" })).toBeTruthy();
		expect(
			(screen.getByLabelText("Nombre de la categoría") as HTMLInputElement)
				.value,
		).toBe("Bebidas");
	});

	it("explains that the category to edit is not in the catalogue", () => {
		setup({ rows: [category({ id: "ca1" })] });

		render(<CategoryWrite categoryId="ca-no-existe" />);

		expect(screen.getByText("No pudimos cargar la categoría")).toBeTruthy();
		expect(
			screen.getByText("Esa categoría ya no existe en esta empresa."),
		).toBeTruthy();
		expect(screen.queryByRole("form")).toBeNull();

		fireEvent.click(
			screen.getByRole("button", { name: "Volver a categorías" }),
		);

		expect(push).toHaveBeenCalledWith("/dashboard/categories");
	});

	it("waits for the catalogue before deciding the category is missing", () => {
		setup({ categoriesState: { data: undefined, isPending: true } });

		render(<CategoryWrite categoryId="ca1" />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
		expect(screen.queryByText("No pudimos cargar la categoría")).toBeNull();
	});

	it("returns to the catalogue when the form is cancelled", () => {
		setup();

		render(<CategoryWrite />);

		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(push).toHaveBeenCalledWith("/dashboard/categories");
	});

	it("refuses to render the form without an active company", () => {
		setup({ company: null });

		render(<CategoryWrite />);

		expect(screen.getByText("No hay una empresa activa")).toBeTruthy();
		expect(screen.queryByRole("form")).toBeNull();
	});
});
