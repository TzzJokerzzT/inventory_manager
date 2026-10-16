import { fireEvent, render, screen } from "@testing-library/react";
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
	const categories = [
		{ value: "electronica", label: "Electrónica" },
		{ value: "hogar", label: "Hogar" },
	];

	/**
	 * El `Select` de Base UI confirma la selección con el gesto de puntero
	 * completo: ni un `click` suelto ni un `pointerDown` solo alcanzan.
	 */
	function chooseOption(fieldLabel: string, optionLabel: string) {
		fireEvent.click(screen.getByLabelText(fieldLabel));
		const option = screen.getByRole("option", { name: optionLabel });
		fireEvent.pointerDown(option);
		fireEvent.pointerUp(option);
		fireEvent.click(option);
	}

	it("associates the label with the trigger and carries the 48px height", () => {
		const { container } = render(
			<SelectField
				label="Categoría"
				name="categoria"
				options={[{ value: "electronica", label: "Electrónica" }]}
			/>,
		);

		// El primitivo de Base UI es un botón con rol combobox, no un <select>
		// nativo; el nombre viaja al formulario por el input oculto.
		const trigger = screen.getByLabelText("Categoría");
		expect(trigger).toBe(screen.getByRole("combobox"));
		expect(trigger.className).toContain("h-12");
		expect(container.querySelector('input[name="categoria"]')).toBeTruthy();
	});

	it("offers every option once the trigger is opened", () => {
		render(
			<SelectField label="Categoría" name="categoria" options={categories} />,
		);

		fireEvent.click(screen.getByLabelText("Categoría"));

		expect(
			screen.getAllByRole("option").map((option) => option.textContent),
		).toEqual(["Electrónica", "Hogar"]);
	});

	it("submits the chosen raw value through the named hidden input", () => {
		const { container } = render(
			<SelectField label="Categoría" name="categoria" options={categories} />,
		);

		chooseOption("Categoría", "Hogar");

		expect(
			(container.querySelector('input[name="categoria"]') as HTMLInputElement)
				.value,
		).toBe("hogar");
	});

	it("reports the raw value, not the label, through onValueChange", () => {
		const onValueChange = jest.fn();
		render(
			<SelectField
				label="Categoría"
				name="categoria"
				value="electronica"
				onValueChange={onValueChange}
				options={categories}
			/>,
		);

		chooseOption("Categoría", "Hogar");

		expect(onValueChange.mock.calls[0][0]).toBe("hogar");
	});
});
