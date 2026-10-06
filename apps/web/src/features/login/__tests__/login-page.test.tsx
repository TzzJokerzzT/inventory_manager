import { fireEvent, render, screen } from "@testing-library/react";
import LoginPage from "@/app/login/page";

function submit() {
	fireEvent.click(screen.getByRole("button", { name: "Ingresar al panel" }));
}

describe("LoginPage", () => {
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

	it("renders the provisional notice on a valid submit without navigating", () => {
		render(<LoginPage />);

		fireEvent.change(screen.getByLabelText("Correo electrónico"), {
			target: { value: "ana@empresa.com" },
		});
		fireEvent.change(screen.getByLabelText("Contraseña"), {
			target: { value: "password123" },
		});
		submit();

		expect(screen.getByRole("alert")).toBeTruthy();
		expect(
			screen.getByText(/autenticación aún no está disponible/i),
		).toBeTruthy();
		expect(screen.getByLabelText("Correo electrónico")).toBeTruthy();
	});

	it("reveals the provisional notice when the forgot-password control is clicked", () => {
		render(<LoginPage />);

		fireEvent.click(
			screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }),
		);

		expect(screen.getByRole("alert")).toBeTruthy();
		expect(
			screen.getByText(/autenticación aún no está disponible/i),
		).toBeTruthy();
	});

	it("keeps internal ticket references out of the provisional notice", () => {
		render(<LoginPage />);

		fireEvent.change(screen.getByLabelText("Correo electrónico"), {
			target: { value: "ana@empresa.com" },
		});
		fireEvent.change(screen.getByLabelText("Contraseña"), {
			target: { value: "password123" },
		});
		submit();

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
