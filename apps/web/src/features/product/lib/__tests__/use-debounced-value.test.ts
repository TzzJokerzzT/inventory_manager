import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "../use-debounced-value";

describe("useDebouncedValue", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("returns the initial value immediately", () => {
		const { result } = renderHook(() => useDebouncedValue("café", 300));

		expect(result.current).toBe("café");
	});

	it("holds the previous value until the delay passes", () => {
		const { result, rerender } = renderHook(
			({ value }: { value: string }) => useDebouncedValue(value, 300),
			{ initialProps: { value: "café" } },
		);

		rerender({ value: "café m" });

		expect(result.current).toBe("café");

		act(() => {
			jest.advanceTimersByTime(299);
		});
		expect(result.current).toBe("café");

		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(result.current).toBe("café m");
	});

	it("keeps only the last keystroke when they arrive faster than the delay", () => {
		const { result, rerender } = renderHook(
			({ value }: { value: string }) => useDebouncedValue(value, 300),
			{ initialProps: { value: "" } },
		);

		rerender({ value: "c" });
		act(() => {
			jest.advanceTimersByTime(100);
		});
		rerender({ value: "ca" });
		act(() => {
			jest.advanceTimersByTime(100);
		});
		rerender({ value: "caf" });

		// 200 ms after the first keystroke nothing fired: the timer restarted.
		act(() => {
			jest.advanceTimersByTime(200);
		});
		expect(result.current).toBe("");

		act(() => {
			jest.advanceTimersByTime(100);
		});
		expect(result.current).toBe("caf");
	});
});
