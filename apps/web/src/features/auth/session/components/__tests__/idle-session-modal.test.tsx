import { fireEvent, render, screen } from "@testing-library/react";
import { IdleSessionModal } from "../idle-session-modal";

function renderModal(
	overrides: Partial<React.ComponentProps<typeof IdleSessionModal>> = {},
) {
	const stayActive = jest.fn();
	const view = render(
		<IdleSessionModal
			open
			idleMinutes={13}
			secondsRemaining={93}
			stayActive={stayActive}
			{...overrides}
		/>,
	);

	return { stayActive, ...view };
}

describe("IdleSessionModal", () => {
	it("renders nothing while the session is not being warned about", () => {
		renderModal({ open: false });

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("explains the idle time and the countdown left", () => {
		renderModal();

		expect(screen.getByRole("dialog", { name: "¿Seguís ahí?" })).toBeTruthy();
		expect(
			screen.getByText("Tu sesión lleva 13 minutos sin actividad."),
		).toBeTruthy();
		expect(screen.getByText("Se cerrará en 1:33.")).toBeTruthy();
	});

	it("formats the countdown as minutes and padded seconds", () => {
		renderModal({ secondsRemaining: 125 });

		expect(screen.getByText("Se cerrará en 2:05.")).toBeTruthy();
	});

	it("announces the countdown politely", () => {
		renderModal();

		const countdown = screen.getByText("Se cerrará en 1:33.");

		expect(countdown.getAttribute("aria-live")).toBe("polite");
	});

	it("keeps the session alive from its single action", () => {
		const { stayActive } = renderModal();

		fireEvent.click(screen.getByRole("button", { name: "Seguir conectado" }));

		expect(stayActive).toHaveBeenCalledTimes(1);
	});

	it("treats dismissing the dialog as activity, never as a logout", () => {
		const { stayActive } = renderModal();

		fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

		expect(stayActive).toHaveBeenCalledTimes(1);
		// The only actions the dialog offers are "close" (which answers the same
		// way) and "Seguir conectado": nothing here can end the session.
		expect(
			screen
				.getAllByRole("button")
				.map(
					(button) =>
						button.textContent?.trim() || button.getAttribute("aria-label"),
				),
		).toEqual(["Cerrar", "Seguir conectado"]);
	});
});
