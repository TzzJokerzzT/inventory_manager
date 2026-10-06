import { config } from "dotenv";

config();

const DEFAULT_PORT = 3001;

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

function readOptional(name: string): string | undefined {
	const value = process.env[name];
	return value === undefined || value.trim() === "" ? undefined : value;
}

function readPort(): number {
	const raw = readOptional("PORT");
	if (raw === undefined) {
		return DEFAULT_PORT;
	}

	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid PORT value: "${raw}"`);
	}

	return port;
}

function readNodeEnvironment(): NodeEnvironment {
	const raw = readOptional("NODE_ENV") ?? "development";
	if (!NODE_ENVIRONMENTS.includes(raw as NodeEnvironment)) {
		throw new Error(`Invalid NODE_ENV value: "${raw}"`);
	}

	return raw as NodeEnvironment;
}

/**
 * Typed accessor over the process environment. `dotenv` is loaded above so a
 * local `.env` file works without extra wiring.
 */
export const env = {
	port: readPort(),
	nodeEnv: readNodeEnvironment(),
} as const;
