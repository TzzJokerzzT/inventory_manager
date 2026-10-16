import { IdentityProviderUnavailableError } from "../src/domain/errors/identity-provider-unavailable-error.js";
import { InvalidCredentialsError } from "../src/domain/errors/invalid-credentials-error.js";
import { RefreshTokenRejectedError } from "../src/domain/errors/refresh-token-rejected-error.js";
import { Auth0IdentityProvider } from "../src/infrastructure/auth0/auth0-identity-provider.js";

const CONFIG = {
	issuerBaseURL: "https://tenant.us.auth0.com/",
	clientId: "client-id-value",
	clientSecret: "client-secret-value",
	audience: "https://inventory-manager-api",
	connection: "Username-Password-Authentication",
};

const EMAIL = "someone@example.com";
const PASSWORD = "SUPERSECRET-PASSWORD";
const REFRESH_TOKEN = "refresh-token-value-to-protect";

const originalFetch = globalThis.fetch;

let fetchMock: jest.Mock;

beforeEach(() => {
	fetchMock = jest.fn();
	globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function buildProvider(): Auth0IdentityProvider {
	return new Auth0IdentityProvider({ ...CONFIG });
}

function jsonResponse(status: number, body: unknown): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as unknown as Response;
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
	return {
		access_token: "access-token",
		refresh_token: "refresh-token",
		id_token: "id-token",
		scope: "openid profile email offline_access",
		expires_in: 86400,
		token_type: "Bearer",
		...overrides,
	};
}

const CONSOLE_METHODS = [
	"log",
	"error",
	"warn",
	"info",
	"debug",
	"trace",
] as const;

function captureConsole() {
	const spies = CONSOLE_METHODS.map((method) =>
		jest.spyOn(console, method).mockImplementation(() => {}),
	);

	return {
		output(): string {
			return spies
				.flatMap((spy) => spy.mock.calls)
				.map((args) => args.map((arg) => String(arg)).join(" "))
				.join("\n");
		},
	};
}

describe("Auth0IdentityProvider", () => {
	it("posts the exact eight form parameters to the token endpoint", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, tokenResponse()));

		await provider.exchangePasswordCredentials({
			email: EMAIL,
			password: PASSWORD,
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

		expect(url).toBe("https://tenant.us.auth0.com/oauth/token");
		expect(init.headers).toMatchObject({
			"content-type": "application/x-www-form-urlencoded",
		});
		expect(init.signal).toBeDefined();

		const params = new URLSearchParams(init.body as string);
		expect(Object.fromEntries(params.entries())).toEqual({
			grant_type: "password",
			username: EMAIL,
			password: PASSWORD,
			client_id: CONFIG.clientId,
			client_secret: CONFIG.clientSecret,
			audience: CONFIG.audience,
			scope: "openid profile email offline_access",
			realm: CONFIG.connection,
		});
	});

	it("maps a successful response to the port token shape without extra fields", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, tokenResponse()));

		const result = await provider.exchangePasswordCredentials({
			email: EMAIL,
			password: PASSWORD,
		});

		// The raw Auth0 payload also carries `id_token`, `scope` and
		// `token_type`: none of them cross the port boundary.
		expect(result).toStrictEqual({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			expiresIn: 86400,
		});
	});

	it("omits refreshToken when the provider returns none", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, tokenResponse({ refresh_token: undefined })),
		);

		const result = await provider.exchangePasswordCredentials({
			email: EMAIL,
			password: PASSWORD,
		});

		expect(result).toStrictEqual({
			accessToken: "access-token",
			expiresIn: 86400,
		});
	});

	it("treats a 200 response missing access_token as IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, tokenResponse({ access_token: undefined })),
		);

		await expect(
			provider.exchangePasswordCredentials({
				email: EMAIL,
				password: PASSWORD,
			}),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});

	it("treats a 200 response missing expires_in as IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, tokenResponse({ expires_in: undefined })),
		);

		await expect(
			provider.exchangePasswordCredentials({
				email: EMAIL,
				password: PASSWORD,
			}),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});

	it("maps a 4xx response to InvalidCredentialsError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(403, {
				error: "invalid_grant",
				error_description: "Wrong email or password.",
			}),
		);

		await expect(
			provider.exchangePasswordCredentials({
				email: EMAIL,
				password: PASSWORD,
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it("maps a 5xx response to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(500, {
				error: "server_error",
				error_description: "The server errored.",
			}),
		);

		await expect(
			provider.exchangePasswordCredentials({
				email: EMAIL,
				password: PASSWORD,
			}),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});

	it("maps a network rejection to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			provider.exchangePasswordCredentials({
				email: EMAIL,
				password: PASSWORD,
			}),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});

	it("never logs the password on a successful exchange", async () => {
		const consoleCapture = captureConsole();
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, tokenResponse()));

		await provider.exchangePasswordCredentials({
			email: EMAIL,
			password: PASSWORD,
		});

		expect(consoleCapture.output()).not.toContain(PASSWORD);
	});

	it("never logs the password on a failing exchange", async () => {
		const consoleCapture = captureConsole();
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(403, {
				error: "invalid_grant",
				error_description: "Wrong email or password.",
			}),
		);

		await expect(
			provider.exchangePasswordCredentials({
				email: EMAIL,
				password: PASSWORD,
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);

		expect(consoleCapture.output()).not.toContain(PASSWORD);
	});
});

describe("Auth0IdentityProvider refreshTokens", () => {
	it("posts the refresh grant form parameters to the token endpoint", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, tokenResponse()));

		await provider.refreshTokens(REFRESH_TOKEN);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

		expect(url).toBe("https://tenant.us.auth0.com/oauth/token");
		expect(init.headers).toMatchObject({
			"content-type": "application/x-www-form-urlencoded",
		});
		expect(init.signal).toBeDefined();

		const params = new URLSearchParams(init.body as string);
		expect(Object.fromEntries(params.entries())).toEqual({
			grant_type: "refresh_token",
			refresh_token: REFRESH_TOKEN,
			client_id: CONFIG.clientId,
			client_secret: CONFIG.clientSecret,
			audience: CONFIG.audience,
			scope: "openid profile email offline_access",
		});
	});

	it("maps a successful response to the port token shape, rotating the refresh token", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, tokenResponse()));

		const result = await provider.refreshTokens(REFRESH_TOKEN);

		expect(result).toStrictEqual({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			expiresIn: 86400,
		});
	});

	it("omits refreshToken when the provider does not rotate it", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, tokenResponse({ refresh_token: undefined })),
		);

		const result = await provider.refreshTokens(REFRESH_TOKEN);

		expect(result).toStrictEqual({
			accessToken: "access-token",
			expiresIn: 86400,
		});
	});

	it("treats a 200 response missing access_token as IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, tokenResponse({ access_token: undefined })),
		);

		await expect(provider.refreshTokens(REFRESH_TOKEN)).rejects.toBeInstanceOf(
			IdentityProviderUnavailableError,
		);
	});

	it("treats a 200 response missing expires_in as IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, tokenResponse({ expires_in: undefined })),
		);

		await expect(provider.refreshTokens(REFRESH_TOKEN)).rejects.toBeInstanceOf(
			IdentityProviderUnavailableError,
		);
	});

	it("maps a 4xx response to RefreshTokenRejectedError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(401, {
				error: "invalid_grant",
				error_description: "The refresh token is expired.",
			}),
		);

		await expect(provider.refreshTokens(REFRESH_TOKEN)).rejects.toBeInstanceOf(
			RefreshTokenRejectedError,
		);
	});

	it("maps a 5xx response to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(500, {
				error: "server_error",
				error_description: "The server errored.",
			}),
		);

		await expect(provider.refreshTokens(REFRESH_TOKEN)).rejects.toBeInstanceOf(
			IdentityProviderUnavailableError,
		);
	});

	it("maps a network rejection to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(provider.refreshTokens(REFRESH_TOKEN)).rejects.toBeInstanceOf(
			IdentityProviderUnavailableError,
		);
	});

	it("never logs the refresh token on a failing exchange", async () => {
		const consoleCapture = captureConsole();
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(401, {
				error: "invalid_grant",
				error_description: "The refresh token is expired.",
			}),
		);

		await expect(provider.refreshTokens(REFRESH_TOKEN)).rejects.toBeInstanceOf(
			RefreshTokenRejectedError,
		);

		expect(consoleCapture.output()).not.toContain(REFRESH_TOKEN);
	});
});
