import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Customer, StockMovement } from "@/lib/api/schemas";
import { useMovements } from "@/src/features/movement/api/use-movements";
import { CustomerDetailPanel } from "../components/customer-detail-panel";

jest.mock("@/src/features/movement/api/use-movements", () => ({
	useMovements: jest.fn(),
}));

const useMovementsMock = useMovements as jest.MockedFunction<
	typeof useMovements
>;

const onClose = jest.fn();

function customer(overrides: Partial<Customer> = {}): Customer {
	return {
		id: "cu1",
		companyId: "c1",
		name: "Distribuidora Pérez",
		email: "ventas@perez.com",
		phone: "+54 11 4321-9876",
		address: "Av. Siempre Viva 742",
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
		...overrides,
	};
}

function sale(overrides: Partial<StockMovement> = {}): StockMovement {
	return {
		id: "m1",
		companyId: "c1",
		productId: "p1",
		type: "OUT",
		quantity: 4,
		reason: "Venta mostrador",
		createdAt: "2026-10-21T12:00:00.000Z",
		product: { id: "p1", name: "Café molido 500g", sku: "CAF-500" },
		actor: { id: "user-1", fullName: "Ana", email: "ana@empresa.com" },
		customerId: "cu1",
		customer: { id: "cu1", name: "Distribuidora Pérez" },
		// Fields the purchase-lot feature added to the contract: a legacy sale
		// carries no lot, no written price and no units.
		lotId: null,
		unitPrice: null,
		units: [],
		...overrides,
	};
}

function stubSales(
	rows: StockMovement[] = [sale()],
	state: Record<string, unknown> = {},
) {
	useMovementsMock.mockReturnValue({
		data: rows,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useMovements>);
}

function renderPanel() {
	return render(
		<CustomerDetailPanel
			companyId="c1"
			customer={customer()}
			onClose={onClose}
		/>,
	);
}

describe("CustomerDetailPanel", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		stubSales();
	});

	it("shows the contact data of the selected customer", () => {
		renderPanel();

		expect(useMovementsMock).toHaveBeenCalledWith("c1", {
			customerId: "cu1",
			type: "OUT",
		});
		expect(
			screen.getByRole("heading", { name: "Detalle del cliente" }),
		).toBeTruthy();
		expect(screen.getByText("Distribuidora Pérez")).toBeTruthy();
		expect(screen.getByText("ventas@perez.com")).toBeTruthy();
		expect(screen.getByText("+54 11 4321-9876")).toBeTruthy();
		expect(screen.getByText("Av. Siempre Viva 742")).toBeTruthy();
	});

	it("lists only the sales of that customer with the agreed columns", () => {
		stubSales([
			sale(),
			sale({
				id: "m2",
				quantity: 6,
				reason: "Venta mayorista",
				createdAt: "2026-10-20T09:30:00.000Z",
				product: { id: "p2", name: "Yerba 1kg", sku: "YER-1K" },
				actor: { id: "user-2", fullName: "Bruno", email: "bruno@empresa.com" },
			}),
		]);

		renderPanel();

		const headers = screen
			.getAllByRole("columnheader")
			.map((header) => header.textContent);

		expect(headers).toEqual([
			"Fecha",
			"Producto",
			"SKU",
			"Cantidad",
			"Motivo",
			"Usuario",
		]);
		expect(screen.getByText("21-10-2026 12:00")).toBeTruthy();
		expect(screen.getByText("Café molido 500g")).toBeTruthy();
		expect(screen.getByText("CAF-500")).toBeTruthy();
		expect(screen.getByText("4")).toBeTruthy();
		expect(screen.getByText("Venta mostrador")).toBeTruthy();
		expect(screen.getByText("Ana")).toBeTruthy();
		expect(screen.getByText("20-10-2026 09:30")).toBeTruthy();
		expect(screen.getByText("Yerba 1kg")).toBeTruthy();
		expect(screen.getByText("YER-1K")).toBeTruthy();
		expect(screen.getByText("Venta mayorista")).toBeTruthy();
		expect(screen.getByText("Bruno")).toBeTruthy();
	});

	it("shows the number of sales and the total units", () => {
		stubSales([sale(), sale({ id: "m2", quantity: 6 })]);

		renderPanel();

		expect(screen.getByText("2 salidas listadas · 10 unidades")).toBeTruthy();
		expect(
			screen.getByText("Se muestran las salidas más recientes."),
		).toBeTruthy();
	});

	it("counts a single sale in the singular", () => {
		stubSales([sale({ quantity: 1 })]);

		renderPanel();

		expect(screen.getByText("1 salida listada · 1 unidad")).toBeTruthy();
	});

	it("says so when the customer has no sales yet", () => {
		stubSales([]);

		renderPanel();

		expect(
			screen.getByText("Este cliente todavía no tiene salidas registradas."),
		).toBeTruthy();
		expect(screen.getByText("0 salidas listadas · 0 unidades")).toBeTruthy();
	});

	it("shows the loading state while the sales are being read", () => {
		stubSales([], { data: undefined, isPending: true });

		renderPanel();

		expect(screen.getByRole("status", { name: "Cargando" })).toBeTruthy();
	});

	it("shows the API message when the sales cannot be read", () => {
		stubSales([], {
			data: undefined,
			isError: true,
			error: new ApiError("No pudimos leer las salidas.", 500),
		});

		renderPanel();

		expect(screen.getByText("No pudimos cargar las salidas")).toBeTruthy();
		expect(screen.getByText("No pudimos leer las salidas.")).toBeTruthy();
	});

	it("falls back on a readable value for missing optional data", () => {
		stubSales([sale({ reason: null, actor: null })]);

		render(
			<CustomerDetailPanel
				companyId="c1"
				customer={customer({ email: null, phone: null, address: null })}
				onClose={onClose}
			/>,
		);

		expect(screen.getByText("Sin motivo")).toBeTruthy();
		expect(screen.getByText("Sin usuario")).toBeTruthy();
		expect(screen.getAllByText("—").length).toBe(3);
	});

	it("closes the panel and returns to the list", () => {
		renderPanel();

		fireEvent.click(screen.getByRole("button", { name: "Volver al listado" }));

		expect(onClose).toHaveBeenCalled();
	});
});
