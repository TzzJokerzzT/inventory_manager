import { render, screen } from "@testing-library/react";
import {
	type AxiosAdapter,
	AxiosError,
	type InternalAxiosRequestConfig,
} from "axios";
import { getApiClient } from "@/lib/api/client";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { useCompanies } from "@/src/features/company/api/use-companies";
import { Provider } from "@/src/providers/providers";
import { useSessionStore } from "@/src/store/session-store/session-store";

const COMPANIES = [
	{ id: "c1", name: "Primera", createdAt: "2026-10-06T00:00:00.000Z" },
];

let counters: { refreshCalls: number; companiesCalls: number };

/**
 * The full provider tree renders `next-themes` with `enableSystem`, which asks
 * the browser for the system colour scheme. jsdom has no `matchMedia`, so the
 * tree cannot mount without this small stand-in.
 */
function installMatchMedia() {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: jest.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: jest.fn(),
			removeListener: jest.fn(),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			dispatchEvent: jest.fn(),
		})),
	});
}

function unauthorizedError(config: InternalAxiosRequestConfig): AxiosError {
	return new AxiosError(
		"Request failed",
		"ERR_BAD_RESPONSE",
		config,
		undefined,
		{
			status: 401,
			statusText: "Error",
			data: { error: { message: "No autorizado" } },
			headers: {},
			config,
		},
	);
}

/**
 * A stateful adapter that only lets `/companies` through with the token the
 * refresh endpoint mints. The first attempt — stale token or none — is a 401,
 * the retry after the refresh carries `fresh-token` and succeeds.
 */
function makeAdapter() {
	const state = { refreshCalls: 0, companiesCalls: 0 };

	const adapter: AxiosAdapter = async (config) => {
		if (config.url === "/auth/refresh") {
			state.refreshCalls += 1;
			return {
				data: { accessToken: "fresh-token", expiresIn: 3600 },
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		}
		if (config.url === "/companies") {
			state.companiesCalls += 1;
			if (config.headers.get("Authorization") === "Bearer fresh-token") {
				return {
					data: COMPANIES,
					status: 200,
					statusText: "OK",
					headers: {},
					config,
				};
			}
			throw unauthorizedError(config);
		}
		throw new Error(`Unexpected url ${config.url}`);
	};

	return { adapter, state };
}

function CompaniesConsumer() {
	const query = useCompanies();

	if (query.isSuccess) {
		return <div>{query.data.map((company) => company.name).join(", ")}</div>;
	}
	if (query.isError) {
		return <div>error</div>;
	}
	return <div>loading</div>;
}

describe("provider 401 refresh wiring", () => {
	const originalUrl = process.env.NEXT_PUBLIC_API_URL;

	beforeAll(() => {
		installMatchMedia();
		process.env.NEXT_PUBLIC_API_URL = "http://api.test";
	});

	afterAll(() => {
		if (originalUrl === undefined) {
			delete process.env.NEXT_PUBLIC_API_URL;
		} else {
			process.env.NEXT_PUBLIC_API_URL = originalUrl;
		}
	});

	beforeEach(() => {
		useSessionStore.setState({ accessToken: undefined, resolved: false });

		// Build the shared client with exactly the options a data hook passes:
		// only the token provider, no refresh handler. This is byte-for-byte
		// what `useCompanies` hands `getApiClient`, so the mount below reuses a
		// client whose first caller lacked `onUnauthorized` — the exact defect
		// this unit closes. The refresh must still work because the handler is
		// registered at module load and read per request, not per first call.
		const made = makeAdapter();
		counters = made.state;
		getApiClient({ getAccessToken }).defaults.adapter = made.adapter;
	});

	it("refreshes once and retries once when the data hook built the client first (token already present)", async () => {
		useSessionStore.getState().setSession({ accessToken: "stale-token" });

		render(
			<Provider>
				<CompaniesConsumer />
			</Provider>,
		);

		await screen.findByText("Primera");

		expect(counters.refreshCalls).toBe(1);
		expect(counters.companiesCalls).toBe(2);
		expect(useSessionStore.getState().accessToken).toBe("fresh-token");
	});

	it("refreshes once and retries once when the bootstrap restores the session at the same time (no token)", async () => {
		render(
			<Provider>
				<CompaniesConsumer />
			</Provider>,
		);

		await screen.findByText("Primera");

		// The bootstrap restore and the 401 share one in-flight refresh.
		expect(counters.refreshCalls).toBe(1);
		expect(counters.companiesCalls).toBe(2);
		expect(useSessionStore.getState().accessToken).toBe("fresh-token");
	});
});
