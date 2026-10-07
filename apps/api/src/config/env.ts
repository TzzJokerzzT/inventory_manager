import { config } from "dotenv";

config();

const DEFAULT_PORT = 3001;

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export type EnvSource = Record<string, string | undefined>;

function readOptional(
	name: string,
	source: EnvSource = process.env,
): string | undefined {
	const value = source[name];
	return value === undefined || value.trim() === "" ? undefined : value;
}

function readPort(source: EnvSource = process.env): number {
	const raw = readOptional("PORT", source);
	if (raw === undefined) {
		return DEFAULT_PORT;
	}

	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid PORT value: "${raw}"`);
	}

	return port;
}

function readNodeEnvironment(source: EnvSource = process.env): NodeEnvironment {
	const raw = readOptional("NODE_ENV", source) ?? "development";
	if (!NODE_ENVIRONMENTS.includes(raw as NodeEnvironment)) {
		throw new Error(`Invalid NODE_ENV value: "${raw}"`);
	}

	return raw as NodeEnvironment;
}

/**
 * Values that must never appear in an error message: they end up in logs and
 * crash reports, and these three carry credentials.
 */
const SECRET_VARIABLES = new Set([
	"DATABASE_URL",
	"DIRECT_URL",
	"AUTH0_CLIENT_SECRET",
]);

function readRequired(
	name: string,
	nodeEnv: NodeEnvironment,
	source: EnvSource,
): string | undefined {
	const value = readOptional(name, source);
	if (value === undefined && nodeEnv === "production") {
		throw new Error(
			`Missing required environment variable in production: ${name}`,
		);
	}

	return value;
}

function readValidated(
	name: string,
	nodeEnv: NodeEnvironment,
	source: EnvSource,
	validate: (value: string) => void,
): string | undefined {
	const value = readRequired(name, nodeEnv, source);
	if (value !== undefined) {
		try {
			validate(value);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			const detail = SECRET_VARIABLES.has(name) ? "" : ` (got "${value}")`;
			throw new Error(`Invalid ${name}: ${reason}${detail}`);
		}
	}

	return value;
}

function assertPostgresUrl(value: string): void {
	if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
		throw new Error("expected a postgresql:// connection string");
	}
}

function assertBareHostname(value: string): void {
	if (value.includes("://") || value.includes("/") || !value.includes(".")) {
		throw new Error(
			'expected a bare hostname such as "your-tenant.us.auth0.com"',
		);
	}
}

function assertAbsoluteUrl(value: string): void {
	try {
		new URL(value);
	} catch {
		throw new Error("expected an absolute URL");
	}
}

/**
 * `WEB_ORIGIN` is an origin, not just any absolute URL: `new URL` happily
 * accepts `localhost:3000` (protocol `localhost:`, path `3000`), and an origin
 * with a path or a query would never match what a browser sends in the `Origin`
 * header, so CORS would silently stop working.
 */
function assertHttpOrigin(value: string): void {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(
			'expected an http(s) origin such as "http://localhost:3000"',
		);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(
			'expected an http(s) origin such as "http://localhost:3000"',
		);
	}

	if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
		throw new Error("expected an origin without a path, query or fragment");
	}
}

/**
 * Builds the typed config from a source, so tests can drive it without
 * touching `process.env`. The seven credentials are required only in
 * production: development, the test suite and CI run without them.
 */
export function loadEnv(source: EnvSource = process.env) {
	const nodeEnv = readNodeEnvironment(source);

	return {
		port: readPort(source),
		nodeEnv,
		databaseUrl: readValidated(
			"DATABASE_URL",
			nodeEnv,
			source,
			assertPostgresUrl,
		),
		directUrl: readValidated("DIRECT_URL", nodeEnv, source, assertPostgresUrl),
		// Origin of the browser app. The API sends credentials (the refresh-token
		// cookie), and a wildcard origin is not allowed with credentials, so the
		// allowed origin has to be named explicitly.
		webOrigin: readValidated("WEB_ORIGIN", nodeEnv, source, assertHttpOrigin),
		auth0: {
			domain: readValidated(
				"AUTH0_DOMAIN",
				nodeEnv,
				source,
				assertBareHostname,
			),
			audience: readValidated(
				"AUTH0_AUDIENCE",
				nodeEnv,
				source,
				assertAbsoluteUrl,
			),
			clientId: readRequired("AUTH0_CLIENT_ID", nodeEnv, source),
			clientSecret: readRequired("AUTH0_CLIENT_SECRET", nodeEnv, source),
			connection: readRequired("AUTH0_CONNECTION", nodeEnv, source),
		},
	} as const;
}

/**
 * Typed accessor over the process environment. `dotenv` is loaded above so a
 * local `.env` file works without extra wiring.
 */
export const env = loadEnv();
