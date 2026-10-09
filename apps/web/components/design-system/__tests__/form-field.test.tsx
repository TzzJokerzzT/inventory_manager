import { render, screen } from "@testing-library/react";
import { SelectField, TextField } from "../form-field";

describe("TextField", () => {
	it("associates the label with the control and carries the 48px height", () => {
		render(<TextField label="Nombre" name="nombre" />);

		const input = screen.getByLabelText("Nombre") as HTMLInputElement;
		expect(input.name).toBe("nombre");
		expect(input.className).toContain("h-12");
	});

	it("sets aria-invalid and an aria-describedby pointing at the error", () => {
		render(
			<TextField label="Email" name="email" error="Ingresá un email válido" />,
		);

		const input = screen.getByLabelText("Email") as HTMLInputElement;
		expect(input.getAttribute("aria-invalid")).toBe("true");

		const message = screen.getByText("Ingresá un email válido");
		expect(input.getAttribute("aria-describedby")).toBe(message.id);
	});

	it("associates the hint via aria-describedby when present", () => {
		render(
			<TextField label="Nombre" name="nombre" hint="Máximo 120 caracteres" />,
		);

		const input = screen.getByLabelText("Nombre") as HTMLInputElement;
		const hint = screen.getByText("Máximo 120 caracteres");
		expect(input.getAttribute("aria-describedby")).toBe(hint.id);
	});

	it("gives two fields without explicit ids distinct ids", () => {
		render(
			<>
				<TextField label="Uno" />
				<TextField label="Dos" />
			</>,
		);

		const one = screen.getByLabelText("Uno");
		const two = screen.getByLabelText("Dos");
		expect(one.id).toBeTruthy();
		expect(two.id).toBeTruthy();
		expect(one.id).not.toBe(two.id);
	});
});

describe("SelectField", () => {
	it("associates the label with the native select and carries the 48px height", () => {
		render(
			<SelectField
				label="Categoría"
				name="categoria"
				options={[{ value: "electronica", label: "Electrónica" }]}
			/>,
		);

		const select = screen.getByLabelText("Categoría") as HTMLSelectElement;
		expect(select.name).toBe("categoria");
		expect(select.className).toContain("h-12");
		expect(screen.getByRole("combobox")).toBeTruthy();
	});
});
