import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { Supplier } from "@/lib/api/schemas";
import { useCreateProvider } from "../api/use-create-provider";
import { useUpdateProvider } from "../api/use-update-provider";
import { ProviderForm } from "../components/provider-form";

jest.mock("../api/use-create-provider", () => ({
	useCreateProvider: jest.fn(),
}));

jest.mock("../api/use-update-provider", () => ({
	useUpdateProvider: jest.fn(),
}));

const useCreateProviderMock = useCreateProvider as jest.MockedFunction<
	typeof useCreateProvider
>;
const useUpdateProviderMock = useUpdateProvider as jest.MockedFunction<
	typeof useUpdateProvider
>;

const createMutate = jest.fn();
const updateMutate = jest.fn();
const onSaved = jest.fn();
const onCancel = jest.fn();

/**
 * The real mutation calls `onSuccess` on success; the stub resumes that contract
 * so the form's "close the panel after saving" path is exercised too.
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
	useCreateProviderMock.mockReturnValue(
		stubMutation(createMutate, state.create) as unknown as ReturnType<
			typeof useCreateProvider
		>,
	);
	useUpdateProviderMock.mockReturnValue(
		stubMutation(updateMutate, state.update) as unknown as ReturnType<
			typeof useUpdateProvider
		>,
	);
}

function supplier(overrides: Partial<Supplier> = {}): Supplier {
	return {
		id: "su1",
		companyId: "c1",
		name: "Plásticos del Sur",
		contact: "Ana Gómez · +54 11 4321-9876",
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

function fill(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function renderCreate() {
	return render(
		<ProviderForm companyId="c1" onSaved={onSaved} onCancel={onCancel} />,
	);
}

function renderEdit(overrides: Partial<Supplier> = {}) {
	return render(
		<ProviderForm
			companyId="c1"
			provider={supplier(overrides)}
			onSaved={onSaved}
			onCancel={onCancel}
		/>,
	);
}

describe("ProviderForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockHooks();
	});

	it("creates a supplier with the trimmed name and the contact", () => {
		renderCreate();

		fill("Nombre del proveedor", "  Plásticos del Sur  ");
		fill("Contacto", "  Ana Gómez · +54 11 4321-9876  ");
		fireEvent.click(screen.getByRole("button", { name: "Crear proveedor" }));

		expect(createMutate).toHaveBeenCalledWith(
			{
				name: "Plásticos del Sur",
				contact: "Ana Gómez · +54 11 4321-9876",
			},
			expect.anything(),
		);
		expect(onSaved).toHaveBeenCalled();
	});

	it("sends null for an empty contact, which is how the API clears it", () => {
		renderCreate();

		fill("Nombre del proveedor", "Plásticos del Sur");
		fireEvent.click(screen.getByRole("button", { name: "Crear proveedor" }));

		expect(createMutate).toHaveBeenCalledWith(
			{ name: "Plásticos del Sur", contact: null },
			expect.anything(),
		);
	});

	it("blocks the submit when the name is blank", () => {
		renderCreate();

		fill("Nombre del proveedor", "   ");
		fireEvent.click(screen.getByRole("button", { name: "Crear proveedor" }));

		expect(createMutate).not.toHaveBeenCalled();
		expect(screen.getByText("Ingresá el nombre del proveedor.")).toBeTruthy();
	});

	it("surfaces the API message when the name is already taken", () => {
		mockHooks({
			create: {
				isError: true,
				error: new ApiError(
					"A supplier with that name already exists in the company",
					409,
					"supplier_name_already_exists",
				),
			},
		});
		renderCreate();

		expect(
			screen.getByText(
				"A supplier with that name already exists in the company",
			),
		).toBeTruthy();
	});

	it("pre-fills the fields of the supplier being edited", () => {
		renderEdit();

		expect(
			(screen.getByLabelText("Nombre del proveedor") as HTMLInputElement).value,
		).toBe("Plásticos del Sur");
		expect((screen.getByLabelText("Contacto") as HTMLInputElement).value).toBe(
			"Ana Gómez · +54 11 4321-9876",
		);
	});

	it("patches the supplier that is being edited", () => {
		renderEdit({ contact: null });

		fill("Contacto", "Compras · compras@plasticos.com");
		fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

		expect(updateMutate).toHaveBeenCalledWith(
			{
				supplierId: "su1",
				name: "Plásticos del Sur",
				contact: "Compras · compras@plasticos.com",
			},
			expect.anything(),
		);
		expect(onSaved).toHaveBeenCalled();
	});

	it("explains a supplier deleted from another tab", () => {
		mockHooks({
			update: {
				isError: true,
				error: new ApiError("Supplier not found", 404, "supplier_not_found"),
			},
		});
		renderEdit();

		expect(
			screen.getByText("Ese proveedor ya no existe en esta empresa."),
		).toBeTruthy();
	});

	it("reports the cancel to the parent", () => {
		renderCreate();

		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(onCancel).toHaveBeenCalled();
		expect(createMutate).not.toHaveBeenCalled();
	});
});
