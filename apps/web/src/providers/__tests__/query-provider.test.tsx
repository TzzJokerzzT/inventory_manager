import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { QueryProvider } from "../query-provider";

const seen: unknown[] = [];

function Consumer() {
	seen.push(useQueryClient());
	return <span>inside-provider</span>;
}

describe("QueryProvider", () => {
	beforeEach(() => {
		seen.length = 0;
	});

	it("renders its children with a query client available", () => {
		render(
			<QueryProvider>
				<Consumer />
			</QueryProvider>,
		);

		expect(screen.getByText("inside-provider")).toBeTruthy();
		expect(seen).toHaveLength(1);
	});

	it("gives each mount its own client instead of sharing one", () => {
		const first = render(
			<QueryProvider>
				<Consumer />
			</QueryProvider>,
		);
		first.unmount();

		render(
			<QueryProvider>
				<Consumer />
			</QueryProvider>,
		);

		expect(seen).toHaveLength(2);
		expect(seen[0]).not.toBe(seen[1]);
	});
});
