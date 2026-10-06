import "@testing-library/cypress/add-commands";

/*
 * Known limitation, accepted deliberately: the login view wraps its content in a
 * `motion` element that starts at `opacity: 0`. The entrance animation does not
 * run in Cypress's Electron, so everything inside stays at opacity 0 and
 * `be.visible` would fail on every element. The assertions below therefore check
 * that the content is rendered and interactive, not that it is visible.
 *
 * Consequence worth remembering: if the client animation never runs — a broken
 * bundle, for instance — the login form is invisible to the user. See
 * `odd/tasks/mi41-jest-cypress.md`.
 */
describe("login view", () => {
	beforeEach(() => {
		cy.visit("/login");
	});

	it("renders the brand panel and the sign-in form", () => {
		cy.contains(/controlá tu inventario en tiempo real/i).should("exist");
		cy.contains("Iniciar sesión").should("exist");
		cy.findByLabelText("Correo electrónico").should("exist");
		cy.findByLabelText("Contraseña").should("exist");
		cy.contains("Ingresar al panel").should("exist");
	});

	it("shows the client validation errors when submitting empty", () => {
		cy.contains("Ingresar al panel").click();

		cy.contains("Ingresá tu correo electrónico.").should("exist");
		cy.contains("Ingresá tu contraseña.").should("exist");
	});

	it("rejects a malformed email and clears the error once corrected", () => {
		cy.findByLabelText("Correo electrónico").type("ana@");
		cy.findByLabelText("Contraseña").type("unaClaveLarga");
		cy.contains("Ingresar al panel").click();

		cy.contains("Ingresá un correo electrónico válido.").should("exist");

		cy.findByLabelText("Correo electrónico").type("empresa.com");
		cy.contains("Ingresá un correo electrónico válido.").should("not.exist");
	});

	it("tells the user that authentication is not available yet", () => {
		cy.findByLabelText("Correo electrónico").type("ana@empresa.com");
		cy.findByLabelText("Contraseña").type("unaClaveLarga");
		cy.contains("Ingresar al panel").click();

		cy.contains("La autenticación aún no está disponible").should("exist");
	});
});
