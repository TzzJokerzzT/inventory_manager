import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import LoginPage from "@/app/login/page";
import { ApiError } from "@/lib/api/client";
import { useLogin } from "../hook/use-login";
import { FALLBACK_ERROR } from "../utils/constants";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

jest.mock("@/src/features/auth/login/hook/use-login.ts", () => ({
	useLogin: jest.fn(),
}));

const useRouterMock = useRouter as jest.MockedFunction<typeof useRouter>;
const useLoginMock = useLogin as jest.MockedFunction<typeof useLogin>;
const replace = jest.fn();
const mutate = jest.fn();

function mockRouter() {
	useRouterMock.mockReturnValue({
		replace,
		push: jest.fn(),
		refresh: jest.fn(),
		back: jest.fn(),
		forward: jest.fn(),
		prefetch: jest.fn(),
	} as unknown as ReturnType<typeof useRouter>);
}

function mockLogin(state: Partial<ReturnType<typeof useLogin>> = {}) {
	useLoginMock.mockReturnValue({
		mutate,
		isPending: false,
		isSuccess: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useLogin>);
}

function fill(values: { email?: string; password?: string }) {
	fireEvent.change(screen.getByLabelText("Correo electrónico"), {
		target: { value: values.email ?? "" },
	});
	fireEvent.change(screen.getByLabelText("Contraseña"), {
		target: { value: values.password ?? "" },
	});
}

function submit() {
	fireEvent.click(
		screen.getByRole("button", {
			name: /Ingresar al panel|Ingresando al panel/,
		}),
	);
}

describe("LoginPage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRouter();
		mockLogin();
	});

	it("resolves both labels to their controls", () => {
		render(<LoginPage />);

		expect(screen.getByLabelText("Correo electrónico")).toBeTruthy();
		expect(screen.getByLabelText("Contraseña")).toBeTruthy();
	});

	it("shows both errors with aria-invalid and matching aria-describedby on empty submit", () => {
		render(<LoginPage />);

		submit();

		const email = screen.getByLabelText(
			"Correo electrónico",
		) as HTMLInputElement;
		const password = screen.getByLabelText("Contraseña") as HTMLInputElement;

		expect(email.getAttribute("aria-invalid")).toBe("true");
		expect(password.getAttribute("aria-invalid")).toBe("true");

		const emailError = screen.getByText("Ingresá tu correo electrónico.");
		const passwordError = screen.getByText("Ingresá tu contraseña.");
		expect(email.getAttribute("aria-describedby")).toBe(emailError.id);
		expect(password.getAttribute("aria-describedby")).toBe(passwordError.id);
	});

	it("moves focus to the first invalid field on a failed submit", () => {
		render(<LoginPage />);

		submit();

		const email = screen.getByLabelText(
			"Correo electrónico",
		) as HTMLInputElement;
		expect(document.activeElement).toBe(email);
	});

	it("clears only the corrected field's error as the user types", () => {
		render(<LoginPage />);

		submit();

		const email = screen.getByLabelText(
			"Correo electrónico",
		) as HTMLInputElement;
		fireEvent.change(email, { target: { value: "ana@empresa.com" } });

		expect(screen.queryByText("Ingresá tu correo electrónico.")).toBeNull();
		expect(screen.getByText("Ingresá tu contraseña.")).toBeTruthy();
	});

	it("sends the trimmed email and the raw password to the login hook", () => {
		render(<LoginPage />);

		// The password keeps its surrounding spaces on purpose: it must reach
		// the hook byte-for-byte. The email is already trimmed because the
		// schema rejects surrounding whitespace before `mutate` is reached.
		fill({ email: "ana@empresa.com", password: " pass word 123 " });
		submit();

		// Only the first argument is the payload; the call may also carry a
		// second options argument (the form is adding one for the toast), and
		// asserting the whole call would couple this test to that shape.
		expect(mutate.mock.calls[0][0]).toEqual({
			email: "ana@empresa.com",
			password: " pass word 123 ",
		});
	});

	it("navigates to /sin-empresas on success without disabling the form", () => {
		mockLogin({ isSuccess: true });

		render(<LoginPage />);

		expect(replace).toHaveBeenCalledWith("/sin-empresas");
		expect(screen.getByLabelText("Correo electrónico")).not.toHaveProperty(
			"disabled",
			true,
		);
	});

	it("shows the API message on an ApiError failure and does not navigate", () => {
		mockLogin({
			isError: true,
			error: new ApiError("Invalid credentials", 401),
		});

		render(<LoginPage />);

		expect(screen.getByText("No pudimos iniciar sesión")).toBeTruthy();
		expect(screen.getByText("Invalid credentials")).toBeTruthy();
		expect(replace).not.toHaveBeenCalled();
	});

	it("shows the generic fallback on a non-ApiError failure", () => {
		mockLogin({ isError: true, error: new Error("network down") });

		render(<LoginPage />);

		expect(screen.getByText(FALLBACK_ERROR)).toBeTruthy();
		expect(replace).not.toHaveBeenCalled();
	});

	it("does not leave the fields disabled after a failed submit", () => {
		render(<LoginPage />);

		submit();

		expect(screen.getByLabelText("Correo electrónico")).not.toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByLabelText("Contraseña")).not.toHaveProperty(
			"disabled",
			true,
		);
	});

	it("renders the recovery notice for the forgot-password control without leaking internal ticket references", () => {
		render(<LoginPage />);

		fireEvent.click(
			screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }),
		);

		expect(screen.getByRole("alert")).toBeTruthy();
		expect(
			screen.getByText(/recuperación de contraseña aún no está disponible/i),
		).toBeTruthy();

		const alert = screen.getByRole("alert");
		expect(/\bMI-\d+\b/.test(alert.textContent ?? "")).toBe(false);
	});

	it("renders the create-account link pointing at /registro", () => {
		render(<LoginPage />);

		const link = screen.getByRole("link", { name: "Crear cuenta" });
		expect(link.getAttribute("href")).toBe("/registro");
	});

	it("renders the forgot-password control as a button", () => {
		render(<LoginPage />);

		const forgot = screen.getByRole("button", {
			name: "¿Olvidaste tu contraseña?",
		}) as HTMLButtonElement;
		expect(forgot.tagName).toBe("BUTTON");
		expect(forgot.getAttribute("type")).toBe("button");
	});

	it("toggles the remember-me checkbox", () => {
		render(<LoginPage />);

		const checkbox = screen.getByLabelText("Recordarme") as HTMLInputElement;
		expect(checkbox.checked).toBe(false);

		fireEvent.click(screen.getByText("Recordarme"));

		expect(checkbox.checked).toBe(true);
	});
});
