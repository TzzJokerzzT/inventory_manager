import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { useCreateProduct } from "../api/use-create-product";
import { useUpdateProduct } from "../api/use-update-product";
import { useUploadProductPhoto } from "../api/use-upload-product-photo";
import { ProductForm } from "../product-form";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
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

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useCreateProductMock = useCreateProduct as jest.MockedFunction<
	typeof useCreateProduct
>;
const useUpdateProductMock = useUpdateProduct as jest.MockedFunction<
	typeof useUpdateProduct
>;
const useUploadProductPhotoMock = useUploadProductPhoto as jest.MockedFunction<
	typeof useUploadProductPhoto
>;

const createMutate = jest.fn();
const updateMutate = jest.fn();
const uploadMutate = jest.fn();
const push = jest.fn();

function stubMutation(mutate: jest.Mock, state: Record<string, unknown> = {}) {
	return {
		mutate,
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
		upload?: Record<string, unknown>;
	} = {},
) {
	useRouterMock.mockReturnValue({
		push,
		replace: jest.fn(),
		refresh: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		prefetch: jest.fn(),
	} as unknown as ReturnType<typeof useRouter>);
	useCreateProductMock.mockReturnValue(
		stubMutation(createMutate, state.create) as unknown as ReturnType<
			typeof useCreateProduct
		>,
	);
	useUpdateProductMock.mockReturnValue(
		stubMutation(updateMutate, state.update) as unknown as ReturnType<
			typeof useUpdateProduct
		>,
	);
	useUploadProductPhotoMock.mockReturnValue(
		stubMutation(uploadMutate, state.upload) as unknown as ReturnType<
			typeof useUploadProductPhoto
		>,
	);
}

function product(overrides: Partial<ProductModel> = {}): ProductModel {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: "Molido medio",
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: "https://res.cloudinary.com/demo/image/upload/cafe.jpg",
		stockQuantity: 0,
		lowStockThreshold: 0,
		measureUnit: "KILOGRAM",
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function fill(name: string, value: string) {
	fireEvent.change(screen.getByLabelText(name), { target: { value } });
}

/**
 * Picks an option of a `SelectField`, which is a Base UI primitive: the
 * trigger is a combobox button and the list opens on click, not on a native
 * `<select>` change.
 */
function chooseOption(fieldLabel: string, optionLabel: string) {
	fireEvent.click(screen.getByLabelText(fieldLabel));
	const option = screen.getByRole("option", { name: optionLabel });
	fireEvent.pointerDown(option);
	fireEvent.pointerUp(option);
	fireEvent.click(option);
}

function submit(label: string) {
	fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("ProductForm (create)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockHooks();
	});

	it("reports the required fields without calling the API", () => {
		render(<ProductForm companyId="c1" />);

		submit("Crear producto");

		expect(screen.getByText("Ingresá el nombre del producto.")).toBeTruthy();
		expect(screen.getByText("Ingresá el código SKU.")).toBeTruthy();
		expect(screen.getByText("Ingresá el precio unitario.")).toBeTruthy();
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("rejects a price the API would reject", () => {
		render(<ProductForm companyId="c1" />);
		fill("Nombre del producto", "Café molido 500g");
		fill("Código SKU", "CAF-500");
		fill("Precio unitario", "1500.001");

		submit("Crear producto");

		expect(
			screen.getByText(
				"Usá un número con hasta dos decimales, por ejemplo 1500.00.",
			),
		).toBeTruthy();
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("creates the product with the normalized values", () => {
		render(<ProductForm companyId="c1" />);
		fill("Nombre del producto", "  Café molido 500g  ");
		fill("Código SKU", " caf-500 ");
		fill("Precio unitario", "1500");
		fill("Descripción del producto", "  Molido medio  ");

		submit("Crear producto");

		expect(createMutate).toHaveBeenCalledWith(
			{
				name: "Café molido 500g",
				sku: "CAF-500",
				price: "1500.00",
				description: "Molido medio",
				photoUrl: null,
				measureUnit: "KILOGRAM",
			},
			expect.any(Object),
		);
	});

	it("starts with Kilogramo and sends the unit the person picks", () => {
		render(<ProductForm companyId="c1" />);
		fill("Nombre del producto", "Pintura");
		fill("Código SKU", "PIN-1");
		fill("Precio unitario", "350");

		// The default is the column's default: a product created before the
		// purchase lots is measured in kilograms.
		expect(screen.getByLabelText("Unidad de medida").textContent).toContain(
			"Kilogramo",
		);

		chooseOption("Unidad de medida", "Litro");
		submit("Crear producto");

		expect(createMutate).toHaveBeenCalledWith(
			expect.objectContaining({ measureUnit: "LITRE" }),
			expect.any(Object),
		);
	});

	it("surfaces sku_already_exists as a readable message", () => {
		mockHooks({
			create: {
				isError: true,
				error: new ApiError("conflict", 409, "sku_already_exists"),
			},
		});

		render(<ProductForm companyId="c1" />);

		expect(
			screen.getByText("Ya existe un producto con ese SKU en esta empresa."),
		).toBeTruthy();
	});

	it("blocks the fields and the submit while the creation is in flight", () => {
		mockHooks({ create: { isPending: true } });

		render(<ProductForm companyId="c1" />);

		expect(
			screen.getByRole("button", { name: /Creando/ }).hasAttribute("disabled"),
		).toBe(true);
		expect(
			screen.getByLabelText("Nombre del producto").hasAttribute("disabled"),
		).toBe(true);
	});

	it("rejects a photo that is not an image before uploading it", () => {
		render(<ProductForm companyId="c1" />);

		const file = new File([new Uint8Array(1)], "foto.gif", {
			type: "image/gif",
		});
		fireEvent.change(screen.getByLabelText("Foto del producto"), {
			target: { files: [file] },
		});

		expect(screen.getByText("La foto debe ser JPG, PNG o WebP.")).toBeTruthy();
		expect(uploadMutate).not.toHaveBeenCalled();
	});
});

describe("ProductForm (edit)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockHooks();
	});

	it("prefills the form with the product being edited", () => {
		render(<ProductForm companyId="c1" product={product()} />);

		expect(
			(screen.getByLabelText("Nombre del producto") as HTMLInputElement).value,
		).toBe("Café molido 500g");
		expect(
			(screen.getByLabelText("Código SKU") as HTMLInputElement).value,
		).toBe("CAF-500");
		expect(
			(screen.getByLabelText("Precio unitario") as HTMLInputElement).value,
		).toBe("1500.00");
		expect(
			screen.getByRole("img", {
				name: "Vista previa de la foto del producto",
			}),
		).toBeTruthy();
	});

	it("patches only the product, sending the cleared photo as null", () => {
		render(<ProductForm companyId="c1" product={product()} />);

		fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
		fill("Descripción del producto", "   ");
		submit("Guardar cambios");

		expect(updateMutate).toHaveBeenCalledWith(
			{
				productId: "p1",
				name: "Café molido 500g",
				sku: "CAF-500",
				price: "1500.00",
				description: null,
				photoUrl: null,
				measureUnit: "KILOGRAM",
			},
			expect.any(Object),
		);
	});

	it("prefills the measure unit of the product and sends a change to it", () => {
		render(
			<ProductForm
				companyId="c1"
				product={product({ measureUnit: "METRE" })}
			/>,
		);

		expect(screen.getByLabelText("Unidad de medida").textContent).toContain(
			"Metro",
		);

		chooseOption("Unidad de medida", "Litro");
		submit("Guardar cambios");

		expect(updateMutate).toHaveBeenCalledWith(
			expect.objectContaining({ measureUnit: "LITRE" }),
			expect.any(Object),
		);
	});

	it("surfaces insufficient_role as a readable message", () => {
		mockHooks({
			update: {
				isError: true,
				error: new ApiError(
					"Tu rol no permite esta acción.",
					403,
					"insufficient_role",
				),
			},
		});

		render(<ProductForm companyId="c1" product={product()} />);

		expect(screen.getByText("Tu rol no permite esta acción.")).toBeTruthy();
	});
});
