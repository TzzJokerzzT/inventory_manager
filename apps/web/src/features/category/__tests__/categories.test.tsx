import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useMe } from "@/src/features/user/api/use-me";
import { useCategories } from "../api/use-categories";
import { useCreateCategory } from "../api/use-create-category";
import { useDeleteCategory } from "../api/use-delete-category";
import { useUpdateCategory } from "../api/use-update-category";
import { Categories } from "../categories";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("@/src/features/user/api/use-me", () => ({
	useMe: jest.fn(),
}));

jest.mock("../api/use-categories", () => ({
	useCategories: jest.fn(),
}));

jest.mock("../api/use-delete-category", () => ({
	useDeleteCategory: jest.fn(),
}));

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
const useMeMock = useMe as jest.MockedFunction<typeof useMe>;
const useCategoriesMock = useCategories as jest.MockedFunction<
	typeof useCategories
>;
const useDeleteCategoryMock = useDeleteCategory as jest.MockedFunction<
	typeof useDeleteCategory
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
	role = "OWNER",
	rows = [category()],
	categoriesState = {},
	company = { id: "c1", name: "Empresa Uno" },
}: {
	role?: "OWNER" | "ADMIN" | "MEMBER";
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
		company
			? {
					...company,
					createdAt: "2026-10-06T00:00:00.000Z",
				}
			: undefined,
	);
	useMeMock.mockReturnValue({
		data: {
			id: "user-1",
			email: "ana@empresa.com",
			fullName: "Ana Pérez",
			createdAt: "2026-10-06T00:00:00.000Z",
			memberships: [
				{
					companyId: "c1",
					role,
					company: {
						id: "c1",
						name: "Empresa Uno",
						createdAt: "2026-10-06T00:00:00.000Z",
					},
				},
			],
		},
		isPending: false,
		isError: false,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useMe>);
	useCategoriesMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		...categoriesState,
	} as unknown as ReturnType<typeof useCategories>);
	useDeleteCategoryMock.mockReturnValue({
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useDeleteCategory>);
	// The form is mocked at the hook level, like the rest of the view: the
	// catalogue test is about which actions are offered, not about saving.
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

describe("Categories", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists the categories of the active company", () => {
		setup({
			rows: [category(), category({ id: "ca2", name: "Lácteos" })],
		});

		render(<Categories />);

		expect(useCategoriesMock).toHaveBeenCalledWith("c1");
		expect(screen.getByRole("heading", { name: "Categorías" })).toBeTruthy();
		expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeTruthy();
		expect(screen.getByText("Bebidas")).toBeTruthy();
		expect(screen.getByText("Lácteos")).toBeTruthy();
	});

	it("shows a meaningful empty state", () => {
		setup({ rows: [] });

		render(<Categories />);

		expect(screen.getByText(/Todavía no hay categorías/)).toBeTruthy();
	});

	it("asks for an active company instead of calling the API without one", () => {
		setup({ company: null });

		render(<Categories />);

		expect(screen.getByText(/Seleccioná una empresa/)).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: /Nueva categoría/ }),
		).toBeNull();
	});

	it("shows the loading state while the catalogue is being read", () => {
		setup({ categoriesState: { data: undefined, isPending: true } });

		render(<Categories />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
	});

	it("shows an alert with the API message when the catalogue cannot be read", () => {
		const error = new ApiError("No tenés acceso a esta empresa.", 403);
		setup({ categoriesState: { data: undefined, isError: true, error } });

		render(<Categories />);

		expect(screen.getByText("No pudimos cargar las categorías")).toBeTruthy();
		expect(screen.getByText("No tenés acceso a esta empresa.")).toBeTruthy();
	});

	it("does not offer any write action to a MEMBER", () => {
		setup({ role: "MEMBER" });

		render(<Categories />);

		// Reading the catalogue is open to every ACTIVE member; writing is not.
		expect(screen.getByText("Bebidas")).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: /Nueva categoría/ }),
		).toBeNull();
		expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
		expect(screen.queryByRole("columnheader", { name: "Acciones" })).toBeNull();
	});

	it("offers the write actions to an ADMIN", () => {
		setup({ role: "ADMIN" });

		render(<Categories />);

		expect(
			screen.getByRole("button", { name: /Nueva categoría/ }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
	});

	it("navigates to the edit route of the chosen category", () => {
		setup({
			rows: [
				category({ id: "ca1", name: "Bebidas" }),
				category({ id: "ca2", name: "Lácteos" }),
			],
		});

		render(<Categories />);

		fireEvent.click(
			screen.getAllByRole("button", { name: "Editar" })[1] as HTMLElement,
		);

		expect(push).toHaveBeenCalledWith("/dashboard/categories/ca2/edit");
	});

	it("navigates to the create route from the header button", () => {
		setup();

		render(<Categories />);

		fireEvent.click(screen.getByRole("button", { name: /Nueva categoría/ }));

		expect(push).toHaveBeenCalledWith("/dashboard/categories/create");
		expect(screen.queryByRole("form", { name: "Crear categoría" })).toBeNull();
	});
});
