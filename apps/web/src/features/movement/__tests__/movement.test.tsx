import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Product as ProductModel, StockMovement } from "@/lib/api/schemas";
import { useActiveCompany } from "@/src/features/company/store/company-selectors";
import { useProducts } from "@/src/features/product/api/use-products";
import { useMovements } from "../api/use-movements";
import { useRegisterMovement } from "../api/use-register-movement";
import { Movement } from "../movement";

jest.mock("@/src/features/company/store/company-selectors", () => ({
	useActiveCompany: jest.fn(),
}));

jest.mock("../api/use-movements", () => ({
	useMovements: jest.fn(),
}));

jest.mock("@/src/features/product/api/use-products", () => ({
	useProducts: jest.fn(),
}));

jest.mock("../api/use-register-movement", () => ({
	useRegisterMovement: jest.fn(),
}));

const useActiveCompanyMock = useActiveCompany as jest.MockedFunction<
	typeof useActiveCompany
>;
const useMovementsMock = useMovements as jest.MockedFunction<
	typeof useMovements
>;
const useProductsMock = useProducts as jest.MockedFunction<typeof useProducts>;
const useRegisterMovementMock = useRegisterMovement as jest.MockedFunction<
	typeof useRegisterMovement
>;

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
	return {
		id: "m1",
		companyId: "c1",
		productId: "p1",
		type: "IN",
		quantity: 10,
		reason: "Compra a proveedor",
		createdAt: "2026-10-21T12:00:00.000Z",
		product: { id: "p1", name: "Café molido 500g", sku: "CAF-500" },
		actor: { id: "user-1", fullName: "Ana Pérez", email: "ana@empresa.com" },
		...overrides,
	};
}

function product(overrides: Partial<ProductModel> = {}): ProductModel {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 8,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function setup({
	rows = [movement()],
	movementsState = {},
	company = {
		id: "c1",
		name: "Empresa Uno",
		createdAt: "2026-10-06T00:00:00.000Z",
	},
	catalogue = [product()],
}: {
	rows?: StockMovement[];
	movementsState?: Record<string, unknown>;
	company?: { id: string; name: string; createdAt: string } | undefined;
	catalogue?: ProductModel[];
} = {}) {
	useActiveCompanyMock.mockReturnValue(company);
	useMovementsMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
		...movementsState,
	} as unknown as ReturnType<typeof useMovements>);
	useProductsMock.mockReturnValue({
		data: catalogue,
		isPending: false,
		isError: false,
		error: undefined,
		refetch: jest.fn(),
	} as unknown as ReturnType<typeof useProducts>);
	useRegisterMovementMock.mockReturnValue({
		mutate: jest.fn(),
		mutateAsync: jest.fn(),
		isPending: false,
		isError: false,
		isSuccess: false,
		error: undefined,
		data: undefined,
	} as unknown as ReturnType<typeof useRegisterMovement>);
}

describe("Movement", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists the real history of the active company", () => {
		setup({
			rows: [
				movement(),
				movement({
					id: "m2",
					type: "OUT",
					quantity: 2,
					reason: "Venta",
					createdAt: "2026-10-20T09:05:00.000Z",
					actor: { id: "user-2", fullName: null, email: "luis@empresa.com" },
				}),
			],
		});

		render(<Movement />);

		// Sin filtros en la vista: el historial completo de la empresa.
		expect(useMovementsMock).toHaveBeenCalledWith("c1");
		expect(
			screen.getAllByRole("columnheader").map((header) => header.textContent),
		).toEqual([
			"Tipo",
			"Producto",
			"SKU",
			"Cantidad",
			"Motivo",
			"Usuario",
			"Fecha",
		]);
		expect(screen.getByText("Entrada")).toBeTruthy();
		expect(screen.getByText("Salida")).toBeTruthy();
		expect(screen.getAllByText("Café molido 500g")).toHaveLength(2);
		expect(screen.getAllByText("CAF-500")).toHaveLength(2);
		expect(screen.getByText("10")).toBeTruthy();
		expect(screen.getByText("Compra a proveedor")).toBeTruthy();
		expect(screen.getByText("Ana Pérez")).toBeTruthy();
		// Deterministic es-AR rendering, no locale-dependent date.
		expect(screen.getByText("21-10-2026 12:00")).toBeTruthy();
		expect(screen.getByText("20-10-2026 09:05")).toBeTruthy();
	});

	it("falls back to the email of an actor without a name", () => {
		setup({
			rows: [
				movement({
					actor: { id: "user-2", fullName: null, email: "luis@empresa.com" },
				}),
			],
		});

		render(<Movement />);

		expect(screen.getByText("luis@empresa.com")).toBeTruthy();
	});

	it("never hides a movement whose actor or reason could not be resolved", () => {
		setup({ rows: [movement({ actor: null, reason: null })] });

		render(<Movement />);

		expect(screen.getByText("Sin usuario")).toBeTruthy();
		expect(screen.getByText("Sin motivo")).toBeTruthy();
	});

	it("shows a meaningful empty state", () => {
		setup({ rows: [] });

		render(<Movement />);

		expect(
			screen.getByText(
				/Todavía no registraste movimientos. Cargá la primera entrada con el formulario/,
			),
		).toBeTruthy();
	});

	it("shows the loading state while the history is being read", () => {
		setup({ movementsState: { data: undefined, isPending: true } });

		render(<Movement />);

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
	});

	it("shows an alert with the API message when the history cannot be read", () => {
		const error = new ApiError("No tenés acceso a esta empresa.", 403);
		setup({ movementsState: { data: undefined, isError: true, error } });

		render(<Movement />);

		expect(screen.getByText("No pudimos cargar los movimientos")).toBeTruthy();
		expect(screen.getByText("No tenés acceso a esta empresa.")).toBeTruthy();
	});

	it("asks for a company when there is no active one", () => {
		setup({ rows: [] });
		useActiveCompanyMock.mockReturnValue(undefined);

		render(<Movement />);

		expect(
			screen.getByText("Seleccioná una empresa para ver sus movimientos."),
		).toBeTruthy();
	});

	it("keeps the entry and exit toggle", () => {
		setup();

		render(<Movement />);

		expect(
			screen.getByRole("heading", { name: "Entrada de productos" }),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Salida de stock" }));

		expect(
			screen.getByRole("heading", { name: "Salida de productos" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Registrar salida" }),
		).toBeTruthy();
	});
});
