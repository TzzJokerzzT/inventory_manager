import { ApiError } from "./client";
import { parseLoginResponse } from "./schemas";

describe("parseLoginResponse", () => {
	it("returns the access token and its lifetime", () => {
		const parsed = parseLoginResponse({
			accessToken: "token-value",
			expiresIn: 3600,
		});

		expect(parsed).toEqual({ accessToken: "token-value", expiresIn: 3600 });
	});

	it("rejects a response missing the token", () => {
		expect(() => parseLoginResponse({ expiresIn: 3600 })).toThrow(ApiError);
	});

	it("rejects a response whose fields have the wrong type", () => {
		expect(() =>
			parseLoginResponse({ accessToken: "token-value", expiresIn: "3600" }),
		).toThrow(/respuesta inesperada/);
	});

	it("does not leak the provider payload when the shape is wrong", () => {
		let message = "";
		try {
			parseLoginResponse({ id_token: "secret-id-token", refresh_token: "x" });
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).not.toContain("secret-id-token");
	});
});
