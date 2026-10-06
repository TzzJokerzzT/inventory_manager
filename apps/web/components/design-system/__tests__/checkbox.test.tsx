import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { Checkbox } from "../checkbox";

describe("Checkbox", () => {
	it("activates the native input when the label is clicked", () => {
		render(<Checkbox label="Recordarme" />);

		const input = screen.getByLabelText("Recordarme") as HTMLInputElement;
		expect(input.checked).toBe(false);

		fireEvent.click(screen.getByText("Recordarme"));

		expect(input.checked).toBe(true);
	});

	it("keeps the native checkbox keyboard-operable", () => {
		render(<Checkbox label="Recordarme" />);

		const input = screen.getByLabelText("Recordarme") as HTMLInputElement;
		expect(input.type).toBe("checkbox");
		input.focus();
		expect(document.activeElement).toBe(input);

		// happy-dom does not implement the native Space -> click activation,
		// so dispatch the click a browser fires for that key.
		fireEvent.keyDown(input, { key: " " });
		fireEvent.click(input);

		expect(input.checked).toBe(true);
	});

	it("reflects the checked state on the native input", () => {
		render(<Checkbox label="Recordarme" defaultChecked />);

		const input = screen.getByLabelText("Recordarme") as HTMLInputElement;
		expect(input.checked).toBe(true);
	});

	it("gives two instances distinct ids", () => {
		render(
			<>
				<Checkbox label="Uno" />
				<Checkbox label="Dos" />
			</>,
		);

		const one = screen.getByLabelText("Uno") as HTMLInputElement;
		const two = screen.getByLabelText("Dos") as HTMLInputElement;
		expect(one.id).toBeTruthy();
		expect(two.id).toBeTruthy();
		expect(one.id).not.toBe(two.id);
	});
});
