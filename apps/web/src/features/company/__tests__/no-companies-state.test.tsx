import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
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

describe("NoCompaniesState", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCreate();
	});

	it("shows the bootstrap option and the assignment alternative", () => {
		render(<NoCompaniesState />);

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
	});

	it("sends the trimmed company name when submitted", () => {
		render(<NoCompaniesState />);
		fillName("  Mi Empresa  ");

		fireEvent.click(screen.getByRole("button", { name: "Crear mi empresa" }));

		expect(mutate).toHaveBeenCalledWith({ name: "Mi Empresa" });
	});

	it("keeps the submit blocked while the name is empty", () => {
		render(<NoCompaniesState />);

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
		render(<NoCompaniesState />);

		expect(screen.getByText("Ese nombre ya está en uso")).toBeTruthy();
	});

	it("shows a busy state and blocks the field while in flight", () => {
		mockCreate({ isPending: true });
		render(<NoCompaniesState />);

		expect(screen.getByRole("button", { name: "Creando..." })).toBeTruthy();
		expect(screen.getByLabelText("Nombre de la empresa")).toHaveProperty(
			"disabled",
			true,
		);
	});
});
