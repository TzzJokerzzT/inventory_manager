import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { QueryProvider } from "@/src/providers/query-provider";
import { useCreateCompany } from "../api/use-create-company";
import { NoCompaniesState } from "../components/no-companies-state";

jest.mock("../api/use-create-company", () => ({
	useCreateCompany: jest.fn(),
}));

const useCreateCompanyMock = useCreateCompany as jest.MockedFunction<
	typeof useCreateCompany
>;
const mutate = jest.fn();

function mockCreate(state: Partial<ReturnType<typeof useCreateCompany>> = {}) {
	useCreateCompanyMock.mockReturnValue({
		mutate,
		isPending: false,
		isSuccess: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useCreateCompany>);
}

function fillName(value: string) {
	fireEvent.change(screen.getByLabelText("Nombre de la empresa"), {
		target: { value },
	});
}

/**
 * The card now also hosts the accept-invitation action, whose mutation needs a
 * query client even though it never fires on render. `useCreateCompany` stays
 * mocked from `../api/use-create-company`, so no request leaves the test.
 */
function renderState() {
	return render(<NoCompaniesState />, { wrapper: QueryProvider });
}

describe("NoCompaniesState", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCreate();
	});

	it("shows the bootstrap option and the assignment alternative", () => {
		renderState();

		expect(
			screen.getByRole("heading", {
				name: "Todavía no tenés una empresa",
			}),
		).toBeTruthy();
		expect(screen.getByLabelText("Nombre de la empresa")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Crear mi empresa" }),
		).toBeTruthy();
		expect(
			screen.getByText("Si alguien te asigna a una empresa, la vas a ver acá."),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Aceptar invitación pendiente" }),
		).toBeTruthy();
	});

	it("sends the trimmed company name when submitted", () => {
		renderState();
		fillName("  Mi Empresa  ");

		fireEvent.click(screen.getByRole("button", { name: "Crear mi empresa" }));

		expect(mutate).toHaveBeenCalledWith({ name: "Mi Empresa" });
	});

	it("keeps the submit blocked while the name is empty", () => {
		renderState();

		expect(
			screen.getByRole("button", { name: "Crear mi empresa" }),
		).toHaveProperty("disabled", true);
		expect(mutate).not.toHaveBeenCalled();
	});

	it("shows the API message when creation fails", () => {
		mockCreate({
			isError: true,
			error: new ApiError("Ese nombre ya está en uso", 409),
		});
		renderState();

		expect(screen.getByText("Ese nombre ya está en uso")).toBeTruthy();
	});

	it("shows a busy state and blocks the field while in flight", () => {
		mockCreate({ isPending: true });
		renderState();

		expect(screen.getByRole("button", { name: "Creando..." })).toBeTruthy();
		expect(screen.getByLabelText("Nombre de la empresa")).toHaveProperty(
			"disabled",
			true,
		);
	});
});
