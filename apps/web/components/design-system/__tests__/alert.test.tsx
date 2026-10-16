import { render, screen } from "@testing-library/react";
import { Alert, type AlertVariant } from "../alert";

const variants: Array<{ variant: AlertVariant; role: "alert" | "status" }> = [
	{ variant: "warning", role: "alert" },
	{ variant: "danger", role: "alert" },
	{ variant: "success", role: "status" },
];

describe("Alert", () => {
	for (const { variant, role } of variants) {
		it(`renders title, description and role for ${variant}`, () => {
			const { container } = render(
				<Alert variant={variant} title={`${variant} title`}>
					{variant} description
				</Alert>,
			);

			expect(screen.getByText(`${variant} title`)).toBeTruthy();
			expect(screen.getByText(`${variant} description`)).toBeTruthy();
			expect(screen.getByRole(role)).toBeTruthy();

			// The icon must be decorative so it never joins the accessible name.
			const icon = container.querySelector("svg");
			expect(icon).toBeTruthy();
			expect(icon?.getAttribute("aria-hidden")).toBe("true");
		});
	}
});
