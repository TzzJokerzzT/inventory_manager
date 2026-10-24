import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { RegisterForm } from "../components/register-form";
import { useRegister } from "../hooks/use-register";
import { TERMS_INTRO, TERMS_SECTIONS } from "../utils/terms";

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
	email?: string;
	password?: string;
	confirmPassword?: string;
}) {
	fireEvent.change(screen.getByLabelText("Correo electrónico"), {
		target: { value: values.email ?? "" },
	});
	fireEvent.change(screen.getByLabelText("Contraseña"), {
		target: { value: values.password ?? "" },
	});
	fireEvent.change(screen.getByLabelText("Confirme la contraseña"), {
		target: { value: values.confirmPassword ?? "" },
	});
}

/**
 * A submit as a person does it: accepting the terms first.
 *
 * The dedicated test below is the one that omits the acceptance, so every other
 * case keeps testing what it was written for instead of the new gate.
 */
function submit() {
	const terms = screen.getByLabelText(
		"Acepto los términos y condiciones",
	) as HTMLInputElement;

	if (!terms.checked) {
		fireEvent.click(terms);
	}

	fireEvent.click(
		screen.getByRole("button", { name: /Registrarme|Registrando/ }),
	);
}

const VALID = {
	email: "ana@empresa.com",
	password: "password123",
	confirmPassword: "password123",
};

describe("RegisterForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRegister();
	});

	it("asks for every field before calling the API", () => {
		render(<RegisterForm />);

		submit();

		expect(screen.getByText("Ingresá tu correo electrónico.")).toBeTruthy();
		expect(screen.getByText("Ingresá tu contraseña.")).toBeTruthy();
		// The confirmation is client-side only, so its message is the mismatch one.
		expect(screen.getByText("Las contraseñas no coinciden.")).toBeTruthy();
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

		// Only email and password: the confirmation is a visual check and never
		// leaves the client.
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

	it("refuses to create the account until the terms are accepted", () => {
		mockRegister();
		render(<RegisterForm />);

		fill(VALID);
		// Straight to the submit, without the checkbox: this is the path the
		// native `required` never guarded, because the form is `noValidate`.
		fireEvent.click(
			screen.getByRole("button", { name: /Registrarme|Registrando/ }),
		);

		expect(mutate).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toContain(
			"Debe que aceptar los términos y condiciones para crear tu cuenta",
		);
	});

	it("shows the terms in a modal, with the version being accepted", () => {
		mockRegister();
		render(<RegisterForm />);

		fireEvent.click(screen.getByRole("button", { name: "Leer los términos" }));

		expect(
			screen.getByRole("dialog", {
				name: "Términos y Condiciones de Uso – App de Gestión de Inventarios",
			}),
		).toBeTruthy();
		expect(screen.getByText(TERMS_INTRO)).toBeTruthy();
		expect(screen.getByText(TERMS_SECTIONS[0].heading)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Entendido" }));

		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
