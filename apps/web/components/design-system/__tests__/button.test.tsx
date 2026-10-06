import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Button } from "../../ui/button";

const variantExpectations: Array<{
	variant: "primary" | "secondary" | "ghost" | "danger";
	classes: string[];
}> = [
	{
		variant: "primary",
		classes: [
			"bg-primary",
			"text-primary-foreground",
			"hover:bg-primary-hover",
		],
	},
	{
		variant: "secondary",
		classes: [
			"bg-secondary",
			"text-secondary-foreground",
			"border-border",
			"hover:bg-surface-muted",
		],
	},
	{
		variant: "ghost",
		classes: ["hover:bg-surface-muted", "hover:text-text-primary"],
	},
	{
		variant: "danger",
		classes: ["bg-destructive", "text-destructive-foreground"],
	},
];

describe("Button design-system additions", () => {
	it("ds size emits the 48px height and 8px radius", () => {
		render(<Button size="ds">Guardar</Button>);

		const button = screen.getByRole("button");
		expect(button.className).toContain("h-12");
		expect(button.className).toContain("rounded-md");
	});

	for (const { variant, classes } of variantExpectations) {
		it(`renders the ${variant} variant with token utilities`, () => {
			render(<Button variant={variant}>Label</Button>);

			const button = screen.getByRole("button");
			for (const cls of classes) {
				expect(button.className).toContain(cls);
			}
		});
	}

	it("ds disabled button keeps the native disabled attribute and label", () => {
		render(
			<Button size="ds" disabled>
				Guardar
			</Button>,
		);

		const button = screen.getByRole("button") as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.textContent).toContain("Guardar");
	});
});
