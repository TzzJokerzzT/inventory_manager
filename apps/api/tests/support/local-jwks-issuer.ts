import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { createServer, type Server } from "node:http";

/**
 * Audience shared by the test tokens and the middleware under test. It plays
 * the role of the Auth0 "API identifier": the `aud` claim must match it exactly.
 */
export const TEST_AUDIENCE = "inventory-manager-api";

export interface TokenClaims {
	sub?: string;
	iss?: string;
	aud?: string | string[];
	exp?: number;
	iat?: number;
	scope?: string;
	[key: string]: unknown;
}

export function base64url(input: Buffer | string): string {
	return Buffer.from(input).toString("base64url");
}

export function generateRsaKeyPair(): {
	publicKey: KeyObject;
	privateKey: KeyObject;
} {
	return generateKeyPairSync("rsa", { modulusLength: 2048 });
}

export function signRs256(
	claims: TokenClaims,
	privateKey: KeyObject,
	kid: string,
): string {
	const header = { alg: "RS256", typ: "JWT", kid };
	const encodedHeader = base64url(JSON.stringify(header));
	const encodedPayload = base64url(JSON.stringify(claims));
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const signature = createSign("RSA-SHA256")
		.update(signingInput)
		.end()
		.sign(privateKey);

	return `${signingInput}.${base64url(signature)}`;
}

export interface LocalIssuer {
	/** `http://127.0.0.1:<port>/` — matches what `createRequireAuth` receives. */
	issuerBaseURL: string;
	/** The `iss` claim value advertised in the discovery document. */
	issuer: string;
	kid: string;
	/** Signs a token with the issuer's own private key and realistic claims. */
	signToken: (overrides?: Partial<TokenClaims>) => string;
	/** Signs a token with an arbitrary private key (for the "wrong key" case). */
	signWithKey: (
		privateKey: KeyObject,
		kid: string,
		overrides?: Partial<TokenClaims>,
	) => string;
	close: () => Promise<void>;
}

/**
 * Starts a throwaway OIDC issuer on an ephemeral port. It serves both the
 * discovery document and the JWKS, because `express-oauth2-jwt-bearer` fetches
 * `/.well-known/openid-configuration` first and follows the `jwks_uri` it
 * advertises. The RSA keypair is generated at test time — no private key
 * fixtures are committed.
 */
export async function startLocalIssuer(): Promise<LocalIssuer> {
	const { publicKey, privateKey } = generateRsaKeyPair();
	const kid = "test-key-1";
	const jwk = {
		...publicKey.export({ format: "jwk" }),
		alg: "RS256",
		kid,
		use: "sig",
	};

	let issuer = "";

	const server: Server = createServer((request, response) => {
		const pathname = (request.url ?? "/").split("?")[0];

		if (pathname === "/.well-known/openid-configuration") {
			const body = JSON.stringify({
				issuer,
				jwks_uri: `${issuer}.well-known/jwks.json`,
				id_token_signing_alg_values_supported: ["RS256"],
			});
			response.writeHead(200, { "content-type": "application/json" });
			response.end(body);
			return;
		}

		if (pathname === "/.well-known/jwks.json") {
			const body = JSON.stringify({ keys: [jwk] });
			response.writeHead(200, { "content-type": "application/json" });
			response.end(body);
			return;
		}

		response.writeHead(404, { "content-type": "application/json" });
		response.end(JSON.stringify({ error: "not found" }));
	});

	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", () => resolve());
	});

	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Local issuer did not bind to a TCP port");
	}
	issuer = `http://127.0.0.1:${address.port}/`;

	const defaults = (): TokenClaims => {
		const now = Math.floor(Date.now() / 1000);
		return {
			sub: "auth0|test-user",
			iss: issuer,
			aud: TEST_AUDIENCE,
			exp: now + 3600,
			iat: now,
			scope: "read:companies write:companies",
		};
	};

	return {
		issuerBaseURL: issuer,
		issuer,
		kid,
		signToken: (overrides = {}) =>
			signRs256({ ...defaults(), ...overrides }, privateKey, kid),
		signWithKey: (key, headerKid, overrides = {}) =>
			signRs256({ ...defaults(), ...overrides }, key, headerKid),
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			}),
	};
}
