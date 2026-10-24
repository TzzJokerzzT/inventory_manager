import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useCreateCompany } from "../../api/use-create-company";
import { CreateCompanyModal } from "../create-company-modal";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("../../api/use-create-company", () => ({
	useCreateCompany: jest.fn(),
}));

const useCreateCompanyMock = useCreateCompany as jest.MockedFunction<
	typeof useCreateCompany
>;
const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const mutate = jest.fn();
const push = jest.fn();

function mockCreate(
	state: Partial<ReturnType<typeof useCreateCompany>> = {},
): void {
	useCreateCompanyMock.mockReturnValue({
		mutate,
		isPending: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useCreateCompany>);
}

function renderModal(onOpenChange: (open: boolean) => void = jest.fn()) {
	render(<CreateCompanyModal open onOpenChange={onOpenChange} />);

	return { onOpenChange };
}

function typeName(value: string): void {
	fireEvent.change(screen.getByLabelText("Nombre de la empresa"), {
		target: { value },
	});
}

function submit(): void {
	fireEvent.click(screen.getByRole("button", { name: "Crear empresa" }));
}

describe("CreateCompanyModal", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCreate();
		useRouterMock.mockReturnValue({
			push,
			replace: jest.fn(),
			refresh: jest.fn(),
			back: jest.fn(),
			forward: jest.fn(),
			prefetch: jest.fn(),
		} as unknown as ReturnType<typeof useRouter>);
	});

	it("cannot submit an empty name", () => {
		renderModal();

		expect(
			(
				screen.getByRole("button", {
					name: "Crear empresa",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
	});

	it("sends the trimmed name to the API", () => {
		renderModal();

		typeName("  Café del Sur  ");
		submit();

		expect(mutate).toHaveBeenCalledTimes(1);
		expect(mutate.mock.calls[0][0]).toEqual({ name: "Café del Sur" });
	});

	it("closes and lands on the dashboard once the company exists", () => {
		const { onOpenChange } = renderModal();

		typeName("Café del Sur");
		submit();

		// The mutation's own success callback is what closes the dialog: it cannot
		// run here, so it is invoked the way react-query would.
		const options = mutate.mock.calls[0][1] as { onSuccess: () => void };
		options.onSuccess();

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(push).toHaveBeenCalledWith("/dashboard");
	});

	it("shows the API message when the company cannot be created", () => {
		mockCreate({
			error: new ApiError("Ya existe una empresa con ese nombre", 409),
		});

		renderModal();

		expect(
			screen.getByText("Ya existe una empresa con ese nombre"),
		).toBeTruthy();
	});

	it("falls back to its own message for an unknown failure", () => {
		mockCreate({ error: new Error("boom") });

		renderModal();

		expect(
			screen.getByText("No pudimos crear la empresa. Probá de nuevo."),
		).toBeTruthy();
	});

	it("blocks the submit while the request is in flight", () => {
		mockCreate({ isPending: true });

		renderModal();

		const button = screen.getByRole("button", {
			name: "Creando...",
		}) as HTMLButtonElement;

		expect(button.disabled).toBe(true);
	});

	it("cancels without calling the API", () => {
		const { onOpenChange } = renderModal();

		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(mutate).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
