import { render, screen, within } from "@testing-library/react";
import Home from "../page";

/**
 * The landing is the only public page, so these tests pin what a visitor must
 * always be able to do: understand what the product is, read that it is free,
 * and get into the app through `/login`.
 *
 * They assert links and structure rather than copy: the wording will change,
 * the promise — free, and one door into `/login` — must not.
 */
describe("landing page", () => {
	it("leads into the app from the hero and from the closing section", () => {
		render(<Home />);

		const entries = screen.getAllByRole("link", { name: /entrar al panel/i });

		expect(entries.length).toBeGreaterThanOrEqual(2);
		for (const entry of entries) {
			expect(entry.getAttribute("href")).toBe("/login");
		}
	});

	it("offers the registration form as the secondary action", () => {
		render(<Home />);

		const registrations = screen.getAllByRole("link", {
			name: /crear mi cuenta/i,
		});

		expect(registrations.length).toBeGreaterThanOrEqual(1);
		for (const link of registrations) {
			expect(link.getAttribute("href")).toBe("/registro");
		}
	});

	it("has a single top-level headline that names the product domain", () => {
		render(<Home />);

		const headline = screen.getByRole("heading", { level: 1 });

		expect(headline.textContent).toMatch(/inventario/i);
	});

	it("states that the application is free", () => {
		render(<Home />);

		const free = document.getElementById("gratis");
		expect(free).not.toBeNull();

		expect(
			within(free as HTMLElement).getByText(/gratis, sin asteriscos/i),
		).toBeTruthy();
		expect(
			within(free as HTMLElement).getByText(/aplicación gratuita/i),
		).toBeTruthy();
	});

	it("lists the shipped features and how to start", () => {
		render(<Home />);

		for (const id of ["features", "facilidad", "gratis"]) {
			expect(document.getElementById(id)).not.toBeNull();
		}

		const features = document.getElementById("features") as HTMLElement;
		expect(within(features).getAllByRole("heading", { level: 3 })).toHaveLength(
			6,
		);

		const steps = document.getElementById("facilidad") as HTMLElement;
		expect(
			within(steps).getAllByRole("listitem").length,
		).toBeGreaterThanOrEqual(3);
	});

	it("keeps the navigation links inside the page, never to a dead route", () => {
		render(<Home />);

		const nav = screen.getByRole("navigation", {
			name: /secciones de la página/i,
		});

		for (const link of within(nav).getAllByRole("link")) {
			expect(link.getAttribute("href")).toMatch(/^#/);
		}
	});
});
