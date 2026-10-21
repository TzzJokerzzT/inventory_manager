import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "..";

function renderModal(
	overrides: Partial<React.ComponentProps<typeof Modal>> = {},
) {
	const onOpenChange = jest.fn();
	const view = render(
		<Modal
			open
			onOpenChange={onOpenChange}
			title="Eliminar producto"
			description="El producto dejará de aparecer en el catálogo."
			{...overrides}
		>
			<p>Contenido del modal</p>
		</Modal>,
	);

	return { onOpenChange, ...view };
}

describe("Modal", () => {
	it("renders nothing while it is closed", () => {
		renderModal({ open: false });

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("exposes the title as the accessible name of the dialog", () => {
		renderModal();

		const dialog = screen.getByRole("dialog", { name: "Eliminar producto" });
		expect(dialog).toBeTruthy();
		expect(screen.getByText("Eliminar producto")).toBeTruthy();
	});

	it("renders the description, the children and the footer", () => {
		renderModal({
			footer: <button type="button">Confirmar</button>,
		});

		const dialog = screen.getByRole("dialog");

		expect(
			screen.getByText("El producto dejará de aparecer en el catálogo."),
		).toBeTruthy();
		expect(screen.getByText("Contenido del modal")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
		expect(dialog.contains(screen.getByText("Contenido del modal"))).toBe(true);
	});

	it("omits the footer area when no footer is given", () => {
		renderModal();

		expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
		expect(screen.getByText("Contenido del modal")).toBeTruthy();
	});

	it("asks to close when Escape is pressed", () => {
		const { onOpenChange } = renderModal();

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("asks to close when the close control is pressed", () => {
		const { onOpenChange } = renderModal();

		fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("labels the close control with closeLabel", () => {
		renderModal({ closeLabel: "Cerrar el diálogo" });

		expect(
			screen.getByRole("button", { name: "Cerrar el diálogo" }),
		).toBeTruthy();
	});

	it("asks to close when the backdrop is pressed", () => {
		const { onOpenChange, container } = renderModal();

		const backdrop = container.ownerDocument.querySelector(
			'[data-slot="modal-backdrop"]',
		);
		expect(backdrop).toBeTruthy();

		// Base UI dismisses on an *intentional* outside press, and in that mode
		// only the completed `click` on an outside element closes the dialog — a
		// lone `pointerdown` does not. The backdrop click is on by default
		// (`disablePointerDismissal` defaults to `false`).
		fireEvent.pointerDown(backdrop as Element);
		fireEvent.click(backdrop as Element);

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
