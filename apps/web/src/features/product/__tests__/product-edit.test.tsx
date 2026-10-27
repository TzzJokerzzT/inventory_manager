import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useCategories } from "@/src/features/category/api/use-categories";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useCreateProduct } from "../api/use-create-product";
import { useProduct } from "../api/use-product";
import { useUpdateProduct } from "../api/use-update-product";
import { useUploadProductPhoto } from "../api/use-upload-product-photo";
import { EditProduct } from "../product-edit";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("../api/use-product", () => ({
	useProduct: jest.fn(),
}));

jest.mock("../api/use-create-product", () => ({
	useCreateProduct: jest.fn(),
}));

jest.mock("../api/use-update-product", () => ({
	useUpdateProduct: jest.fn(),
}));

jest.mock("../api/use-upload-product-photo", () => ({
	useUploadProductPhoto: jest.fn(),
}));

jest.mock("@/src/features/category/api/use-categories", () => ({
	useCategories: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useProductMock = useProduct as jest.MockedFunction<typeof useProduct>;
const useCreateProductMock = useCreateProduct as jest.MockedFunction<
	typeof useCreateProduct
>;
const useUpdateProductMock = useUpdateProduct as jest.MockedFunction<
	typeof useUpdateProduct
>;
const useUploadProductPhotoMock = useUploadProductPhoto as jest.MockedFunction<
	typeof useUploadProductPhoto
>;
const useCategoriesMock = useCategories as jest.MockedFunction<
	typeof useCategories
>;

function stubMutation() {
	return {
		mutate: jest.fn(),
		isPending: false,
		isError: false,
		error: undefined,
	};
}

function setup(productState: Record<string, unknown> = {}) {
	useRouterMock.mockReturnValue({
		push: jest.fn(),
		replace: jest.fn(),
		refresh: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		prefetch: jest.fn(),
	} as unknown as ReturnType<typeof useRouter>);
	useActiveCompanyMock.mockReturnValue({
		id: "c1",
		name: "Empresa Uno",
		createdAt: "2026-10-06T00:00:00.000Z",
	});
	useProductMock.mockReturnValue({
		data: {
			id: "p1",
			companyId: "c1",
			name: "Café molido 500g",
			description: null,
			sku: "CAF-500",
			price: "1500.00",
			photoUrl: null,
			stockQuantity: 0,
			lowStockThreshold: 0,
			measureUnit: "KILOGRAM",
			categoryId: null,
			categoryName: null,
			createdAt: "2026-10-20T12:00:00.000Z",
			updatedAt: "2026-10-20T12:00:00.000Z",
		},
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...productState,
	} as unknown as ReturnType<typeof useProduct>);
	useCreateProductMock.mockReturnValue(
		stubMutation() as unknown as ReturnType<typeof useCreateProduct>,
	);
	useUpdateProductMock.mockReturnValue(
		stubMutation() as unknown as ReturnType<typeof useUpdateProduct>,
	);
	useUploadProductPhotoMock.mockReturnValue(
		stubMutation() as unknown as ReturnType<typeof useUploadProductPhoto>,
	);
	useCategoriesMock.mockReturnValue({
		data: [],
		isPending: false,
		isError: false,
		error: undefined,
	} as unknown as ReturnType<typeof useCategories>);
}

describe("EditProduct", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reads the product so a direct navigation works with a cold cache", () => {
		setup();

		render(<EditProduct productId="p1" />);

		expect(useProductMock).toHaveBeenCalledWith("c1", "p1");
		expect(
			(screen.getByLabelText("Nombre del producto") as HTMLInputElement).value,
		).toBe("Café molido 500g");
	});

	it("shows a loading state while the product is being read", () => {
		setup({ data: undefined, isPending: true });

		render(<EditProduct productId="p1" />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
	});

	it("shows the API message when the product does not exist", () => {
		setup({
			data: undefined,
			isError: true,
			error: new ApiError(
				"No encontramos el producto.",
				404,
				"product_not_found",
			),
		});

		render(<EditProduct productId="p1" />);

		expect(screen.getByText("No encontramos el producto.")).toBeTruthy();
	});
});
