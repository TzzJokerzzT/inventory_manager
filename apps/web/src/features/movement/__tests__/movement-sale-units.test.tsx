import { fireEvent, render, screen } from "@testing-library/react";
import type {
	Product as ProductModel,
	ProductUnit as ProductUnitModel,
} from "@/lib/api/schemas";
import { MovementSaleUnits } from "../movement-sale-units";

function product(overrides: Partial<ProductModel> = {}): ProductModel {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: null,
		sku: "CAF-500",
		price: "1500.00",
		measureUnit: "KILOGRAM",
		photoUrl: null,
		stockQuantity: 8,
		lowStockThreshold: 0,
		categoryId: null,
		categoryName: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function unit(overrides: Partial<ProductUnitModel> = {}): ProductUnitModel {
	return {
		id: "u1",
		code: "R-01",
		measure: "12.500",
		cost: "73750.00",
		status: "AVAILABLE",
		lotId: "lo1",
		receivedAt: "2026-10-23T12:00:00.000Z",
		...overrides,
	};
}

function renderUnits({
	units = [unit()],
	selectedUnitIds = [],
	isPending = false,
	isError = false,
	error,
	product: selectedProduct = product(),
	disabled = false,
}: {
	units?: ProductUnitModel[];
	selectedUnitIds?: string[];
	isPending?: boolean;
	isError?: boolean;
	error?: string;
	product?: ProductModel;
	disabled?: boolean;
} = {}) {
	const onToggleUnit = jest.fn();

	render(
		<MovementSaleUnits
			product={selectedProduct}
			units={units}
			isPending={isPending}
			isError={isError}
			selectedUnitIds={selectedUnitIds}
			onToggleUnit={onToggleUnit}
			error={error}
			disabled={disabled}
		/>,
	);

	return { onToggleUnit };
}

describe("MovementSaleUnits", () => {
	it("lists each unit with its code, its measure and its cost", () => {
		renderUnits({
			units: [
				unit({ id: "u1", code: "R-01", measure: "12.500", cost: "73750.00" }),
				unit({ id: "u2", code: "R-02", measure: "13.000", cost: "76700.00" }),
			],
		});

		// La medida lleva la unidad en la que el producto se compra (kg/L/m); el
		// precio de venta es otro número y nunca la lleva.
		expect(screen.getByText("R-01 · 12,500 kg · $ 73.750,00")).toBeTruthy();
		expect(screen.getByText("R-02 · 13,000 kg · $ 76.700,00")).toBeTruthy();
	});

	it("names the measure in the product's own unit", () => {
		renderUnits({
			product: product({ measureUnit: "LITRE" }),
			units: [unit({ measure: "1.250", cost: "5900.00" })],
		});

		expect(screen.getByText("R-01 · 1,250 L · $ 5.900,00")).toBeTruthy();
	});

	it("reports how many units are selected out of how many are available", () => {
		renderUnits({
			units: [unit({ id: "u1" }), unit({ id: "u2" }), unit({ id: "u3" })],
			selectedUnitIds: ["u1", "u2"],
		});

		expect(screen.getByText("2 de 3 unidades")).toBeTruthy();
	});

	it("starts at zero selected", () => {
		renderUnits({ units: [unit({ id: "u1" }), unit({ id: "u2" })] });

		expect(screen.getByText("0 de 2 unidades")).toBeTruthy();
	});

	it("marks the selected units as checked and toggles through the callback", () => {
		const { onToggleUnit } = renderUnits({
			units: [unit({ id: "u1" }), unit({ id: "u2", code: "R-02" })],
			selectedUnitIds: ["u1"],
		});

		const first = screen.getByLabelText(/R-01/) as HTMLInputElement;
		const second = screen.getByLabelText(/R-02/) as HTMLInputElement;
		expect(first.checked).toBe(true);
		expect(second.checked).toBe(false);

		fireEvent.click(second);

		// El componente no guarda estado: avisa y el formulario decide (L25).
		expect(onToggleUnit).toHaveBeenCalledWith("u2");
	});

	it("reports the load state in Spanish", () => {
		renderUnits({ isPending: true, units: [] });

		expect(screen.getByText("Cargando unidades…")).toBeTruthy();
		expect(screen.queryByText(/de \d+ unidades/)).toBeNull();
	});

	it("reports a failed read in Spanish, without inventing units", () => {
		renderUnits({ isError: true });

		expect(
			screen.getByText("No pudimos cargar las unidades. Probá de nuevo."),
		).toBeTruthy();
		expect(screen.queryByRole("checkbox")).toBeNull();
	});

	it("reports the validation message the form decided", () => {
		renderUnits({ error: "Elegí al menos una unidad para la venta." });

		expect(
			screen.getByText("Elegí al menos una unidad para la venta."),
		).toBeTruthy();
	});

	it("disables every unit while the sale is being registered", () => {
		renderUnits({ units: [unit({ id: "u1" })], disabled: true });

		expect((screen.getByLabelText(/R-01/) as HTMLInputElement).disabled).toBe(
			true,
		);
	});

	it("never calls a unit by a product-specific name", () => {
		renderUnits({ units: [unit({ id: "u1" }), unit({ id: "u2" })] });

		// L18: la interfaz habla de unidades, no del ejemplo que originó la feature.
		expect(document.body.textContent ?? "").not.toMatch(/rollo/i);
	});
});
