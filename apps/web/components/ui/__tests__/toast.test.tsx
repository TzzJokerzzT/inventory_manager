import { act, render, screen } from "@testing-library/react";
import {
	createToastManager,
	Toaster,
	toastVariantClass,
} from "@/components/ui/toast";

/**
 * The mapping is asserted without rendering, and the render case below proves the
 * wiring: a pure map that nothing applies would pass the first half and ship a
 * colourless toast.
 */
describe("toastVariantClass", () => {
	it("gives success the success palette", () => {
		expect(toastVariantClass("success")).toContain("bg-success-soft");
		expect(toastVariantClass("success")).toContain("text-success-text");
	});

	it("gives warning the warning palette", () => {
		expect(toastVariantClass("warning")).toContain("bg-warning-soft");
		expect(toastVariantClass("warning")).toContain("text-warning-text");
	});

	it("gives error the danger palette", () => {
		expect(toastVariantClass("error")).toContain("bg-danger-soft");
		expect(toastVariantClass("error")).toContain("text-danger-text");
	});

	it("leaves info and loading on the neutral surface", () => {
		expect(toastVariantClass("info")).toBeUndefined();
		expect(toastVariantClass("loading")).toBeUndefined();
		expect(toastVariantClass(undefined)).toBeUndefined();
	});

	it("uses the readable danger token and not destructive", () => {
		expect(toastVariantClass("error")).not.toContain("destructive");
	});
});

describe("Toaster colouring", () => {
	it("applies the palette of the toast type", async () => {
		const manager = createToastManager();
		render(<Toaster toastManager={manager} />);

		act(() => {
			manager.add({
				type: "warning",
				title: "Stock bajo",
				description: "Quedan 3 unidades",
			});
		});

		const title = await screen.findByText("Stock bajo");
		const root = title.closest('[data-slot="toast"]');

		expect(root).not.toBeNull();
		expect(root?.className).toContain("bg-warning-soft");
		expect(root?.className).toContain("text-warning-text");
	});
});
