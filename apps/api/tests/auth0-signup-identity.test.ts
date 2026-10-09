import { IdentityProviderUnavailableError } from "../src/domain/errors/identity-provider-unavailable-error.js";
import { InvalidCredentialsError } from "../src/domain/errors/invalid-credentials-error.js";
import { SignUpRejectedError } from "../src/domain/errors/sign-up-rejected-error.js";
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

describe("Auth0IdentityProvider.signUp", () => {
	it("posts exactly the four expected fields to the signup endpoint as JSON", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, {}));

		await provider.signUp({ email: EMAIL, password: PASSWORD });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

		expect(url).toBe("https://tenant.us.auth0.com/dbconnections/signup");
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({
			"content-type": "application/json",
		});
		expect(init.signal).toBeDefined();
		expect(JSON.parse(init.body as string)).toEqual({
			client_id: CONFIG.clientId,
			email: EMAIL,
			password: PASSWORD,
			connection: CONFIG.connection,
		});
	});

	it("resolves with no meaningful value on success", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, {
				email: EMAIL,
				email_verified: false,
				_id: "auth0-generated-id",
			}),
		);

		await expect(
			provider.signUp({ email: EMAIL, password: PASSWORD }),
		).resolves.toBeUndefined();
	});

	it("maps a 4xx to SignUpRejectedError with a fixed message that does not echo Auth0", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(400, {
				name: "BadRequestError",
				code: "invalid_signup",
				description: "The email is already in use by a different account.",
				statusCode: 400,
			}),
		);

		const error = await provider
			.signUp({ email: EMAIL, password: PASSWORD })
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(SignUpRejectedError);
		expect((error as Error).message).toBe("Sign up rejected");
		expect((error as Error).message).not.toContain("invalid_signup");
		expect((error as Error).message).not.toContain("already in use");
	});

	it("maps a 5xx to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(500, { code: "server_error", description: "Down." }),
		);

		await expect(
			provider.signUp({ email: EMAIL, password: PASSWORD }),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});

	it("maps a network rejection to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			provider.signUp({ email: EMAIL, password: PASSWORD }),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});

	it("never logs the password on a successful sign up", async () => {
		const consoleCapture = captureConsole();
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, {}));

		await provider.signUp({ email: EMAIL, password: PASSWORD });

		expect(consoleCapture.output()).not.toContain(PASSWORD);
	});

	it("never logs the password when sign up is rejected", async () => {
		const consoleCapture = captureConsole();
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(400, {
				code: "invalid_signup",
				description: "Invalid sign up",
			}),
		);

		await expect(
			provider.signUp({ email: EMAIL, password: PASSWORD }),
		).rejects.toBeInstanceOf(SignUpRejectedError);

		expect(consoleCapture.output()).not.toContain(PASSWORD);
	});
});

describe("Auth0IdentityProvider.getIdentity", () => {
	it("reads sub, email and email_verified from the userinfo endpoint", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, {
				sub: "auth0|abc123",
				email: EMAIL,
				email_verified: true,
			}),
		);

		const identity = await provider.getIdentity("access-token-123");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

		expect(url).toBe("https://tenant.us.auth0.com/userinfo");
		expect(init.method).toBe("GET");
		expect(init.headers).toMatchObject({
			authorization: "Bearer access-token-123",
		});
		expect(init.signal).toBeDefined();

		expect(identity).toEqual({
			auth0Sub: "auth0|abc123",
			email: EMAIL,
			emailVerified: true,
		});
	});

	it("treats a missing email_verified as false", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, { sub: "auth0|abc123", email: EMAIL }),
		);

		const identity = await provider.getIdentity("access-token-123");

		expect(identity).toEqual({
			auth0Sub: "auth0|abc123",
			email: EMAIL,
			emailVerified: false,
		});
	});

	it("treats a non-boolean email_verified as false", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(200, {
				sub: "auth0|abc123",
				email: EMAIL,
				email_verified: "true",
			}),
		);

		const identity = await provider.getIdentity("access-token-123");

		expect(identity.emailVerified).toBe(false);
	});

	it("maps a failing userinfo to IdentityProviderUnavailableError, not InvalidCredentialsError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(
			jsonResponse(401, {
				error: "invalid_token",
				error_description: "The token is expired.",
			}),
		);

		const error = await provider
			.getIdentity("access-token-123")
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(IdentityProviderUnavailableError);
		expect(error).not.toBeInstanceOf(InvalidCredentialsError);
	});

	it("maps a 200 response missing sub or email to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockResolvedValue(jsonResponse(200, { sub: "auth0|abc123" }));

		await expect(
			provider.getIdentity("access-token-123"),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});

	it("maps a network rejection to IdentityProviderUnavailableError", async () => {
		const provider = buildProvider();
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			provider.getIdentity("access-token-123"),
		).rejects.toBeInstanceOf(IdentityProviderUnavailableError);
	});
});
