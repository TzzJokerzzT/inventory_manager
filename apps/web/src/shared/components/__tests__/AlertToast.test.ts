import { toast } from "@/components/ui/toast";
import { AlertToast } from "../AlertToast";

jest.mock("@/components/ui/toast", () => ({
	toast: { add: jest.fn() },
}));

const add = toast.add as unknown as jest.Mock;

/** The options the last `toast.add` call received. */
function lastOptions() {
	return add.mock.calls[0][0] as {
		title: string;
		description: string;
		type?: string;
		timeout?: number;
	};
}

describe("AlertToast", () => {
	beforeEach(() => {
		add.mockClear();
	});

	it("passes the message through", () => {
		AlertToast({
			title: "Listo",
			description: "Todo salió bien",
			type: "warning",
		});

		expect(lastOptions()).toMatchObject({
			title: "Listo",
			description: "Todo salió bien",
			type: "warning",
		});
	});

	it("auto-closes after the default delay", () => {
		AlertToast({ title: "Listo", description: "Todo salió bien" });

		expect(lastOptions().timeout).toBe(3000);
	});

	it("auto-closes after the delay it is given", () => {
		AlertToast({ title: "Listo", description: "Todo salió bien", delay: 8000 });

		expect(lastOptions().timeout).toBe(8000);
	});

	it("never auto-closes when autoclose is false", () => {
		// Base UI reads `timeout: 0` as "do not dismiss automatically", which is
		// the only way to express a toast the person has to close themselves.
		AlertToast({
			title: "Listo",
			description: "Todo salió bien",
			autoclose: false,
		});

		expect(lastOptions().timeout).toBe(0);
	});
});
