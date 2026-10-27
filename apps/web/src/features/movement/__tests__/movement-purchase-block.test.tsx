import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { Product as ProductModel } from "@/lib/api/schemas";
import { validatePurchase } from "@/src/features/lot/lib/validate-purchase";
import { useProviders } from "@/src/features/provider/api/use-providers";
import { MovementPurchaseBlock } from "../movement-purchase-block";

jest.mock("@/src/features/provider/api/use-providers", () => ({
	useProviders: jest.fn(),
}));

const useProvidersMock = useProviders as jest.MockedFunction<
	typeof useProviders
>;

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

function provider(id: string, name: string) {
	return {
		id,
		companyId: "c1",
		name,
		contact: null,
		createdAt: "2026-10-22T12:00:00.000Z",
		updatedAt: "2026-10-22T12:00:00.000Z",
		lastLot: null,
	};
}

/**
 * The block is controlled: the form owns the state and decides when the errors
 * are shown. The harness reproduces exactly that, so the test exercises the same
 * contract the form uses instead of a copy of it.
 */
function Harness({
	selectedProduct = product(),
}: {
	selectedProduct?: ProductModel;
}) {
	const [open, setOpen] = useState(false);
	const [values, setValues] = useState({
		supplierId: "",
		costPerMeasure: "",
		measures: "",
	});
	const [attempted, setAttempted] = useState(false);

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				setAttempted(true);
			}}
		>
			<MovementPurchaseBlock
				companyId="c1"
				product={selectedProduct}
				open={open}
				onOpenChange={setOpen}
				values={values}
				onValueChange={(patch) =>
					setValues((previous) => ({ ...previous, ...patch }))
				}
				errors={attempted ? validatePurchase(values) : {}}
				disabled={false}
			/>
			<button type="submit">Guardar</button>
		</form>
	);
}

function fill(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
	fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
}

describe("MovementPurchaseBlock", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useProvidersMock.mockReturnValue({
			data: [provider("su1", "Plásticos del Sur")],
			isPending: false,
			isError: false,
			error: undefined,
			refetch: jest.fn(),
		} as unknown as ReturnType<typeof useProviders>);
	});

	it("starts closed, so an entry keeps behaving as a loose entry", () => {
		render(<Harness />);

		const toggle = screen.getByRole("button", {
			name: "Registrar compra por medida",
		});
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByLabelText("Proveedor")).toBeNull();
		expect(screen.queryByLabelText("Medida de cada unidad")).toBeNull();
		// Cerrado no se lee el padrón: el bloque no cuesta una request.
		expect(useProvidersMock).not.toHaveBeenCalled();
	});

	it("opens the purchase fields, with the price labelled in the product's unit", () => {
		render(<Harness selectedProduct={product({ measureUnit: "LITRE" })} />);

		fireEvent.click(
			screen.getByRole("button", { name: "Registrar compra por medida" }),
		);

		expect(
			screen
				.getByRole("button", { name: "Registrar compra por medida" })
				.getAttribute("aria-expanded"),
		).toBe("true");
		expect(useProvidersMock).toHaveBeenCalledWith("c1");
		expect(screen.getByLabelText("Proveedor")).toBeTruthy();
		// La medida es cómo se COMPRA el producto (L20): el $ va por litro.
		expect(screen.getByLabelText("$ por L")).toBeTruthy();
		expect(screen.getByLabelText("Medida de cada unidad")).toBeTruthy();
	});

	it("rejects an empty supplier, price and measure list in Spanish", () => {
		render(<Harness />);

		fireEvent.click(
			screen.getByRole("button", { name: "Registrar compra por medida" }),
		);
		submit();

		expect(screen.getByText("Seleccioná un proveedor.")).toBeTruthy();
		expect(screen.getByText("Ingresá el $ por medida.")).toBeTruthy();
		expect(screen.getByText("Ingresá la medida de cada unidad.")).toBeTruthy();
	});

	it("reports the measure token it could not read", () => {
		render(<Harness />);

		fireEvent.click(
			screen.getByRole("button", { name: "Registrar compra por medida" }),
		);
		fill("Medida de cada unidad", "12.5\ndoce");
		submit();

		expect(screen.getByText(/«doce»/)).toBeTruthy();
	});

	it("computes the live summary and the purchase total", () => {
		render(<Harness />);

		fireEvent.click(
			screen.getByRole("button", { name: "Registrar compra por medida" }),
		);
		fill("$ por kg", "5900");
		fill("Medida de cada unidad", "12,5 13");

		// 12,5 + 13 = 25,5 kg a $ 5.900 el kg = $ 150.450,00.
		expect(screen.getByText("2 unidades · Σ medida 25,500 kg")).toBeTruthy();
		expect(screen.getByText("Total: $ 150.450,00")).toBeTruthy();
	});

	it("never mixes the sale price with the purchase measure", () => {
		render(<Harness selectedProduct={product({ price: "1500.00" })} />);

		fireEvent.click(
			screen.getByRole("button", { name: "Registrar compra por medida" }),
		);

		// El precio de venta es por unidad y no lleva la unidad de medida (L20): el
		// bloque sólo etiqueta el $ de la compra, que sí es por medida.
		expect(screen.queryByText(/\$ 1\.500,00/)).toBeNull();
		expect(screen.getByLabelText("$ por kg")).toBeTruthy();
	});
});
