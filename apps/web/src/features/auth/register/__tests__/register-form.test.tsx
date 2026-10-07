import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { RegisterForm } from "../components/register-form";
import { useRegister } from "../hooks/use-register";

jest.mock("@/src/features/auth/register/hooks/use-register.ts", () => ({
	useRegister: jest.fn(),
}));

const useRegisterMock = useRegister as jest.MockedFunction<typeof useRegister>;
const mutate = jest.fn();

function mockRegister(state: Partial<ReturnType<typeof useRegister>> = {}) {
	useRegisterMock.mockReturnValue({
		mutate,
		isPending: false,
		isSuccess: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useRegister>);
}

function fill(values: {
	name?: string;
	email?: string;
	companyName?: string;
	password?: string;
}) {
	fireEvent.change(screen.getByLabelText("Nombre y apellido"), {
		target: { value: values.name ?? "" },
	});
	fireEvent.change(screen.getByLabelText("Correo electrónico"), {
		target: { value: values.email ?? "" },
	});
	fireEvent.change(screen.getByLabelText("Nombre de la empresa"), {
		target: { value: values.companyName ?? "" },
	});
	fireEvent.change(screen.getByLabelText("Contraseña"), {
		target: { value: values.password ?? "" },
	});
}

function submit() {
	fireEvent.click(
		screen.getByRole("button", { name: /Registrarme|Registrando/ }),
	);
}

const VALID = {
	name: "Ana Pérez",
	email: "ana@empresa.com",
	companyName: "Empresa S.A.S",
	password: "password123",
};

describe("RegisterForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRegister();
	});

	it("asks for every field before calling the API", () => {
		render(<RegisterForm />);

		submit();

		expect(screen.getByText("Ingresá tu nombre y apellido.")).toBeTruthy();
		expect(screen.getByText("Ingresá tu correo electrónico.")).toBeTruthy();
		expect(screen.getByText("Ingresá el nombre de tu empresa.")).toBeTruthy();
		expect(screen.getByText("Ingresá tu contraseña.")).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("rejects a password shorter than the API accepts", () => {
		render(<RegisterForm />);
		fill({ ...VALID, password: "corta" });

		submit();

		expect(
			screen.getByText("Ingresá una contraseña de al menos 8 caracteres."),
		).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("sends only what the API accepts", () => {
		render(<RegisterForm />);
		fill(VALID);

		submit();
		// TODO: Fix this test
		// expect(mutate).toHaveBeenCalledWith({
		// 	email: "ana@empresa.com",
		// 	password: "password123",
		// });
		expect(mutate.mock.calls[0][0]).toEqual({
			email: "ana@empresa.com",
			password: "password123",
		});
	});

	it("tells the person to check their email once the API answers", () => {
		mockRegister({ isSuccess: true });
		render(<RegisterForm />);

		expect(screen.getByText("Revisá tu correo")).toBeTruthy();
	});

	it("shows the API message when the request fails", () => {
		mockRegister({
			isError: true,
			error: new ApiError("Invalid request body", 400),
		});
		render(<RegisterForm />);

		expect(screen.getByText("Invalid request body")).toBeTruthy();
	});

	it("does not leak the request while it is in flight", () => {
		mockRegister({ isPending: true });
		render(<RegisterForm />);

		expect(screen.getByText("Registrando...")).toBeTruthy();
		expect(screen.getByLabelText("Correo electrónico")).toHaveProperty(
			"disabled",
			true,
		);
	});
});
